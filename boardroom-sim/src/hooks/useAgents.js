import { parseJsonObject, parseJsonArray } from '../lib/api.js';
import { MEMBER_MODELS } from '../lib/constants.js';

// All AI agent runner functions.
// callGemini / callGeminiWithSearch / callOpenRouter are injected wrappers from App.jsx
// that already capture apiKey, onStatusChange, and onTokensUsed.
// setBoardMembers is injected so runAlignmentAgent can update member stats.

/**
 * Parse a member response for optional action request tags.
 * Returns { type: 'vote'|'research'|null, proposal?, query?, cleanText }
 */
export function parseActionRequest(text) {
  const voteMatch = text.match(/\[REQUEST_VOTE:\s*(.+?)\]/s);
  const researchMatch = text.match(/\[REQUEST_RESEARCH:\s*(.+?)\]/s);
  const questionMatch = text.match(/\[REQUEST_QUESTION:\s*(.+?)\]/s);
  const proposeDocMatch = text.match(/\[PROPOSE_DOC:\s*([^\|]+?)\s*\|\s*([\s\S]+?)\]/);
  const editDocMatch = text.match(/\[EDIT_DOC:\s*([^\|]+?)\s*\|\s*([\s\S]+?)\s*\|\s*([^\]]+?)\]/);
  const cleanText = text
    .replace(/\s*\[(REQUEST_VOTE|REQUEST_RESEARCH|REQUEST_QUESTION):[^\]]+\]/g, '')
    .replace(/\s*\[(PROPOSE_DOC|EDIT_DOC):[\s\S]+?\]/g, '')
    .trim();
  if (voteMatch) return { type: 'vote', proposal: voteMatch[1].trim(), cleanText };
  if (researchMatch) return { type: 'research', query: researchMatch[1].trim(), cleanText };
  if (questionMatch && questionMatch[1].trim()) return { type: 'question', question: questionMatch[1].trim(), cleanText };
  if (editDocMatch) return { type: 'doc', isEdit: true, docTitle: editDocMatch[1].trim(), docContent: editDocMatch[2].trim(), docSummary: editDocMatch[3].trim(), cleanText };
  if (proposeDocMatch) return { type: 'doc', isEdit: false, docTitle: proposeDocMatch[1].trim(), docContent: proposeDocMatch[2].trim(), cleanText };
  return { type: null, cleanText: text };
}

export function useAgents({ callGeminiWithSearch, callOpenRouter, setBoardMembers, userName = "", briefMode = false }) {

  const formatMsgForHistory = (m) => {
    if (m.type === 'research') {
      const facts = Array.isArray(m.keyFacts) && m.keyFacts.length > 0 ? ` Key facts: ${m.keyFacts.join(' | ')}` : '';
      return `Research (query: "${m.query}"): ${m.headline || ''}${facts}`;
    }
    return `${m.sender}: ${m.text}`;
  };

  const runOrchestratorAgent = async (history, newMsg, currentMinutes, members, facts, forcedSpeaker) => {
    const recentHistory = history.slice(-5).map(formatMsgForHistory).join('\n');
    const fullHistory = history.map(formatMsgForHistory).join('\n');
    const recentSpeakers = history.slice(-4)
      .filter(m => m.role === 'assistant')
      .map(m => m.sender);
    const recentSpeakerNote = recentSpeakers.length > 0
      ? `Recently spoke (avoid picking again): ${[...new Set(recentSpeakers)].join(', ')}`
      : '';

    const prompt = `
      Current Notes: ${JSON.stringify(currentMinutes)}
      Whiteboard Facts: ${facts}
      Recent Chat: ${recentHistory}
      New Message: "${newMsg.sender}: ${newMsg.text}"
      Participants: ${members.map(m => `${m.role} (${m.name})`).join(', ')}
      ${recentSpeakerNote}
      Force Speaker: ${forcedSpeaker ? forcedSpeaker.role : "None"}

      Do these tasks:
      1. Update the session notes based on the new message. For actionItems, add any new tasks, decisions, or follow-ups that emerge from the discussion. Keep existing items that are still relevant and remove completed ones.
      2. Pick who speaks next. IMPORTANT: Rotate between members — do NOT pick someone who just spoke unless they are the only one with something relevant to say. Choose the member whose expertise is most relevant to the current topic.
         Write a direction describing what angle they should take. The direction should describe the topic and perspective, NOT be phrased as someone talking to them (e.g., say "Focus on the implications of the proposed timeline" NOT "Tell the group about concerns").
      3. If the conversation contains a specific factual question requiring real-world data (statistics, prices, market caps, recent events, regulations), set researchNeeded to true and provide a concise researchQuery string. Otherwise set both to their defaults.
      4. Decide if a formal vote is needed. Set callVote to true ONLY when one of these two conditions is met:
         - Blocker/Deadlock: Two or more members have clearly opposing positions on a key issue and further discussion is going in circles (friction is high, no new arguments are being made).
         - Decision Point: The discussion has naturally produced a concrete, actionable proposal that needs group approval (e.g., 'adopt approach X', 'allocate resources to Z', 'proceed with option A'). The proposal should be specific enough to vote YES or NO on.
         If callVote is true, write a specific 1-2 sentence "proposal" stating the exact motion being voted on. Do NOT call a vote just because the conversation has gone on for a while — only when there is something concrete to decide or a deadlock to break.

      Output purely JSON:
      {
        "minutes": { "consensus": "...", "friction": "...", "momentum": "...", "actionItems": ["..."] },
        "nextSpeakerRole": "Role",
        "briefing": "...",
        "researchNeeded": false,
        "researchQuery": "",
        "callVote": false,
        "proposal": ""
      }
    `;
    const system = `You are the Scene Orchestrator. You manage session notes and decide who speaks next. Pick from: ${members.map(m => m.role).join(', ')}. Output purely JSON with no markdown, no code fences, no extra text.`;
    const result = await callOpenRouter(prompt, system, 'anthropic/claude-3-haiku', 800);

    let parsed = { minutes: currentMinutes, nextSpeakerRole: forcedSpeaker?.role || members[0].role, briefing: "Respond naturally to the last message.", researchNeeded: false, researchQuery: "", callVote: false, proposal: "" };
    if (result) {
      try {
        const obj = parseJsonObject(result);
        if (obj) parsed = { ...parsed, ...obj };
      } catch (e) {
        // Second attempt: aggressively extract just the key fields via targeted regex fallback
        try {
          const nextRole = result.match(/"nextSpeakerRole"\s*:\s*"([^"]+)"/)?.[1];
          const briefing = result.match(/"briefing"\s*:\s*"([^"]+)"/)?.[1];
          const callVote = /"callVote"\s*:\s*true/i.test(result);
          const researchNeeded = /"researchNeeded"\s*:\s*true/i.test(result);
          const researchQuery = result.match(/"researchQuery"\s*:\s*"([^"]+)"/)?.[1];
          const proposal = result.match(/"proposal"\s*:\s*"([^"]+)"/)?.[1];
          if (nextRole) parsed.nextSpeakerRole = nextRole;
          if (briefing) parsed.briefing = briefing;
          parsed.callVote = callVote;
          parsed.researchNeeded = researchNeeded;
          if (researchQuery) parsed.researchQuery = researchQuery;
          if (proposal) parsed.proposal = proposal;
        } catch (_) { /* silently keep defaults */ }
      }
    } else {
      return null;
    }

    const member = forcedSpeaker || members.find(m =>
      parsed.nextSpeakerRole && m.role.toLowerCase().includes(parsed.nextSpeakerRole.toLowerCase())
    ) || members[0];

    return {
      minutes: parsed.minutes || currentMinutes,
      nextSpeaker: member.role,
      nextSpeakerName: member.name,
      nextSpeakerAvatar: member.avatar,
      briefing: parsed.briefing,
      memberObj: member,
      fullHistory,
      triggeringMsg: `${newMsg.sender}: ${newMsg.text}`,
      researchNeeded: parsed.researchNeeded || false,
      researchQuery: parsed.researchQuery || "",
      callVote: parsed.callVote || false,
      proposal: parsed.proposal || ""
    };
  };

  const runBoardMemberAgent = async ({ memberObj, briefing, fullHistory, triggeringMsg, allowResearch = true, documents = [] }) => {
    const prompt = `FULL SESSION TRANSCRIPT:
${fullHistory || "(session just started)"}

THE MESSAGE YOU MUST RESPOND TO:
"${triggeringMsg}"

[YOUR ANGLE — do not mention or reference this section]:
${briefing}

Respond in character as ${memberObj.name}. Directly address what was just said. Do NOT give a generic opener. Do NOT reference any instructions or behind-the-scenes guidance — you are speaking directly to the other participants.`;
    const addressee = userName ? `You are speaking with ${userName}.` : ``;
    const brevityInstruction = briefMode ? ` IMPORTANT: Maximum 1-2 sentences. One punchy point only. No fluff.` : ``;
    const existingDocTitles = documents.length > 0 ? ` Existing documents you can amend: ${documents.map(d => `"${d.title}"`).join(', ')}.` : '';
    const docActionsNote = memberObj.canEditDocs !== false
      ? `- To draft a new document, bill, or policy append this EXACT format at the very end: [PROPOSE_DOC: Document Title | The full text of the document goes here, can be multiple sentences or paragraphs.]\n- To amend an existing document append this EXACT format: [EDIT_DOC: Document Title | The complete updated document text | One sentence summary of what changed].${existingDocTitles} Important: the tag must be on one continuous line with no line breaks inside the brackets. If someone directly asks you to draft, write, or create a document, you MUST use [PROPOSE_DOC: ...] — do NOT just say you will do it without including the tag.\n`
      : '';
    const actionsNote = `

AVAILABLE ACTIONS (use sparingly, only when the moment genuinely calls for it):
- Append [REQUEST_VOTE: your proposed motion] at the very end of your response if there is a clear decision point or deadlock that warrants a formal vote.
${allowResearch ? '- Append [REQUEST_RESEARCH: your search query] at the very end if a specific fact would meaningfully change the discussion.\n' : ''}${docActionsNote}- Append [REQUEST_QUESTION: your question] at the very end ONLY if you need one specific, critical piece of information from the user that you cannot proceed without. Do not use this for rhetorical questions or general engagement — only use it when you genuinely require an answer to continue.
Only use one of these when it is truly appropriate. Do not use them routinely.`;
    const lengthGuide = briefMode ? `1-2 sentences.` : `3-5 sentences.`;
    const system = `You are ${memberObj.name}, the ${memberObj.role}. ${memberObj.description}. ${addressee} Respond directly to what was just said. Keep it to ${lengthGuide}${brevityInstruction}${actionsNote}`;
    const modelId = memberObj.model || "gemini-2.0-flash";
    const modelDef = MEMBER_MODELS.find(m => m.id === modelId);
    if (modelDef?.provider === "openrouter") {
      return await callOpenRouter(prompt, system, modelId, 400) || "...";
    }
    return await callOpenRouter(prompt, system, 'anthropic/claude-3-haiku') || "...";
  };

  // messages, minutes, whiteboardFacts are passed explicitly (not captured from App state)
  const generateProposal = async (messages, minutes, whiteboardFacts) => {
    const recentChat = messages.slice(-6).map(m => `${m.sender}: ${m.text}`).join('\n');
    const researchReports = messages
      .filter(m => m.type === 'research')
      .map(m => {
        const facts = Array.isArray(m.keyFacts) && m.keyFacts.length > 0 ? ` Key facts: ${m.keyFacts.join(' | ')}` : '';
        return `- Query: "${m.query}": ${m.headline || ''}${facts}`;
      })
      .join('\n');
    const prompt = `Based on the session discussion, formulate a clear, concise motion/proposal that the group should vote on. This should be 1-2 sentences that clearly state what is being decided. Be specific — reference the actual topic, not generic language.

Notes: ${JSON.stringify(minutes)}
Whiteboard Facts: ${whiteboardFacts}
${researchReports ? `Research Reports:\n${researchReports}\n` : ''}Recent Discussion:
${recentChat}

Output only the proposal text, nothing else.`;
    const result = await callOpenRouter(prompt, "You are the Secretary. Write a formal motion/proposal for a group vote. Output only the proposal text.", 'anthropic/claude-3-haiku', 150);
    return result || "Motion to proceed as discussed.";
  };

  const runBatchVoteAgent = async (members, currentMinutes, facts, proposal = "", options = [], clarification = "", messages = []) => {
    const memberList = members.map(m => `- ${m.role} (${m.name}): ${m.description}`).join('\n');
    const isMulti = options.length >= 2;
    const optionLabels = options.map((o, i) => `${String.fromCharCode(65 + i)}. ${o}`).join('\n');
    const researchReports = messages
      .filter(m => m.type === 'research')
      .map(m => {
        const keyFacts = Array.isArray(m.keyFacts) && m.keyFacts.length > 0 ? ` Key facts: ${m.keyFacts.join(' | ')}` : '';
        return `- Query: "${m.query}": ${m.headline || ''}${keyFacts}`;
      })
      .join('\n');

    const prompt = `
      THE MOTION ON THE TABLE:
      "${proposal || 'General motion to proceed based on discussion.'}"

      ${isMulti ? `OPTIONS:\n${optionLabels}\n` : ''}
      ${clarification ? `CHAIR'S NOTE: "${clarification}"\n` : ''}
      Notes: ${JSON.stringify(currentMinutes)}
      Facts: ${facts}
      ${researchReports ? `Research Reports:\n${researchReports}\n` : ''}
      Participants:
      ${memberList}

      ${isMulti
        ? `Each participant votes for ONE option (${options.map((_, i) => String.fromCharCode(65 + i)).join(', ')}) with a 5-word reason based on their personality and motivations.\n      Output purely JSON array: [{ "member": "Role", "vote": "A", "reason": "..." }, ...]`
        : `Each participant votes YES or NO on the above motion with a 5-word reason based on their personality and motivations.\n      Output purely JSON array: [{ "member": "Role", "vote": "YES", "reason": "..." }, ...]`
      }
    `;
    const system = `You are running a group vote. Each participant votes independently based on their unique personality. Output purely JSON array.`;
    const result = await callOpenRouter(prompt, system, 'anthropic/claude-3-haiku', 600);
    if (result) {
      try {
        const arr = parseJsonArray(result);
        if (arr) return arr;
      } catch (e) { console.warn("Batch vote JSON failed"); }
    }
    return members.map(m => ({ member: m.role, vote: isMulti ? "A" : "ABSTAIN", reason: "Thinking..." }));
  };

  const runResolutionAgent = async (results, minutes, passed, options = null) => {
    const optionContext = options ? `\nOptions were: ${options.map((o, i) => `${String.fromCharCode(65 + i)}: ${o}`).join(', ')}` : '';
    const prompt = `Vote Passed: ${passed}${optionContext}\nVotes: ${JSON.stringify(results)}\nNotes: ${JSON.stringify(minutes)}\nWrite 2 sentence resolution.`;
    return await callOpenRouter(prompt, "You are the Secretary.", 'anthropic/claude-3-haiku') || "Resolution unavailable.";
  };

  const runResearchAgent = async (query) => {
    const prompt = `You are a research assistant. A factual question came up that requires a real-world lookup.
Research query: "${query}"

Respond with a JSON object (no markdown, no code fences) with these exact keys:
- "headline": one crisp sentence — the single most important finding
- "keyFacts": array of 3-5 bullet strings, each a distinct fact with numbers/dates where relevant
- "context": 1-2 sentences of background or trend context
- "caveats": one short sentence on data freshness or important limitations (or null if none)

Use the most current data available. Facts only — no editorializing.`;
    const result = await callGeminiWithSearch(prompt, 700);
    if (!result) return null;
    const parsed = parseJsonObject(result.text);
    if (parsed) {
      return {
        headline: parsed.headline || '',
        keyFacts: Array.isArray(parsed.keyFacts) ? parsed.keyFacts : [],
        context: parsed.context || '',
        caveats: parsed.caveats || null,
        sources: result.sources || [],
      };
    }
    // fallback: treat raw text as headline
    return { headline: result.text, keyFacts: [], context: '', caveats: null, sources: result.sources || [] };
  };

  const runAlignmentAgent = async (lastMsg, members) => {
    const prompt = `
      Message: "${lastMsg.sender} says: ${lastMsg.text}"
      Participants & Motivations:
      ${members.map(m => `- ${m.role} (${m.name}): ${m.description}`).join('\n')}
      Task: Analyze impact on agreement (0-100) of EACH member.
      Return JSON array of objects with 'role' and 'delta' (-15 to +15).
    `;
    const result = await callOpenRouter(prompt, "You are an AI Analyst. Output purely JSON.", 'anthropic/claude-3-haiku', 300);
    if (result) {
      try {
        const adjustments = parseJsonArray(result);
        if (adjustments) {
          setBoardMembers(prev => prev.map(member => {
            const adj = adjustments.find(a => a.role === member.role || a.role === member.name);
            if (adj) {
              const newScore = Math.min(100, Math.max(0, member.stats.agreement + adj.delta));
              return { ...member, stats: { ...member.stats, agreement: newScore } };
            }
            return member;
          }));
        }
      } catch (e) {}
    }
  };

  // boardMembers and whiteboardFacts are passed explicitly so this function stays pure.
  // context = { members?, whiteboard? } can override them (used by template modal).
  const runAIBuilderAgent = async (conversationHistory, context = {}, boardMembers = [], whiteboardFacts = "") => {
    const historyText = conversationHistory
      .map(m => {
        if (m.type === 'user-chat') return `User: ${m.text}`;
        if (m.type === 'ai-chat') return `AI: ${m.text}`;
        if (m.type === 'suggestions') return `AI previously suggested these roles: ${m.members?.map(mem => `${mem.role} (${mem.name})`).join(', ') || 'none'}.`;
        return null;
      })
      .filter(Boolean)
      .join('\n');

    const memberList = context.members ?? boardMembers;
    const existingRoles = memberList.map(m => m.role).join(', ');
    const whiteboardContent = (context.whiteboard ?? whiteboardFacts).trim() || "No whiteboard context provided.";

    const userPrompt = `
WHITEBOARD CONTEXT:
${whiteboardContent}

EXISTING PARTICIPANTS (do not suggest duplicates):
${existingRoles}

CONVERSATION SO FAR:
${historyText || "(No prior exchanges — this is your opening message)"}

AVATAR OPTIONS (pick one per member):
bg-blue-600, bg-purple-600, bg-yellow-600, bg-pink-600, bg-green-600, bg-red-600, bg-orange-600

TASK:
Based on the whiteboard context and the conversation history, decide:
1. If the user's latest message directly requests ONE specific person or role (e.g. "add a cynical rogue", "I want an aggressive warrior", "give me a skeptical wizard"), return EXACTLY 1 participant that precisely matches that description. Do NOT return a general list in this case.
2. If the user's latest message contains broader feedback, a direction, or multiple requests (e.g. "add someone focused on X", "no, focus on Y", "I want 3 different options"), generate NEW suggestions that directly address what they said. Do NOT repeat the roles you already suggested.
3. If the conversation is empty or you genuinely need specific information to give useful suggestions, ask 1-2 targeted clarifying questions.
4. Otherwise, return 4-6 participant suggestions tailored to the scenario and any prior conversation.

RULES:
- Never suggest a role that already exists in the existing participants list.
- Each suggested member must have a distinct role, a realistic first name, and a rich multi-dimensional description.
- Stats: agreement (0-100) = how likely they agree by default. aggression (0-100) = how forcefully they push back.

DESCRIPTION REQUIREMENTS — each description must be 4-6 sentences covering ALL of:
1. Career background and domain expertise
2. Core motivation / what they are protecting or trying to achieve
3. Communication style and signature behaviors (e.g. "asks for data before committing", "uses humor to deflect")
4. A known blind spot or cognitive bias that will show up in discussions
5. How they behave under pressure or when their position is challenged

OUTPUT FORMAT — respond ONLY with one of these two JSON shapes, no markdown:

Shape A (need more info):
{ "type": "message", "text": "Your single concise question here." }

Shape B (ready to suggest):
{
  "type": "suggestions",
  "intro": "One sentence explaining your choices.",
  "members": [
    {
      "name": "First name",
      "role": "Role Title",
      "avatar": "bg-XXXXX-600",
      "description": "4-6 sentences covering background, motivation, communication style, blind spot, and pressure behavior.",
      "stats": { "agreement": 50, "aggression": 35 }
    }
  ]
}
    `.trim();

    const systemInstruction = `You are an expert casting director and character designer. Your job is to understand a scenario from a whiteboard and create deeply realized, psychologically complex character personas that will generate productive tension and diverse perspectives. You always respond with pure JSON only — no markdown, no explanation outside the JSON.`;

    const result = await callOpenRouter(userPrompt, systemInstruction, 'anthropic/claude-3-haiku', 2500);
    if (!result) return null;

    try {
      const obj = parseJsonObject(result);
      if (obj) return obj;
    } catch (e) {
      console.warn("AI Builder JSON parse failed:", e);
    }
    return null;
  };

  return {
    runOrchestratorAgent,
    runBoardMemberAgent,
    generateProposal,
    runBatchVoteAgent,
    runResolutionAgent,
    runResearchAgent,
    runAlignmentAgent,
    runAIBuilderAgent,
  };
}
