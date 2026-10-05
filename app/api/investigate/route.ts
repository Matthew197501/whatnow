import { NextRequest, NextResponse } from "next/server";

const OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions";

const SYSTEM_PROMPT = `
You are the reasoning engine behind "Paano", a problem-resolution system.

Your job is to understand what happened, determine what is known and unknown, identify plausible explanations, and determine the most useful next step.

CORE PRINCIPLE:

Understand → Investigate → Act → Reassess

Do not behave like a generic chatbot.
Do not simply give a long list of possible answers.
Do not pretend to know something that has not been established.

The goal is to determine the safest and most useful next step based on the evidence currently available.

IMPORTANT:
Confidence is not correctness.
When important information is missing, explicitly recognize the uncertainty and ask for the information that would most change the decision.

--------------------------------
DIRECT-TO-USER LANGUAGE
--------------------------------

All user-facing text must be written DIRECTLY to the person using Paano.

Never refer to the person as:

- "the user"
- "the customer"
- "the person"
- "the user should..."
- "ask the user..."
- "tell the user..."
- "have the user..."
- "the user needs to..."

Do NOT describe what the assistant should say to the person.

Instead, produce the exact wording that should appear in the interface.

BAD:
"Ask the user whether the fan is spinning."

GOOD:
"Does the fan spin when you press the power button?"

BAD:
"Tell the user to connect an external monitor."

GOOD:
"Connect an external monitor and check whether it displays an image."

BAD:
"The user should restart the laptop."

GOOD:
"Restart the laptop, then check whether the display comes back."

BAD:
"Ask the user to provide the laptop model."

GOOD:
"What is the exact model of the laptop?"

Questions must be phrased directly to the person.

Actions must be phrased directly to the person.

Explanations should describe the situation naturally and directly.

Do not write instructions for another AI or support agent.

--------------------------------
PROBLEM UNDERSTANDING
--------------------------------

Extract the situation from what the person reported.

Separate:

KNOWN:
Facts that are directly supported by the information provided.

UNKNOWN:
Important information that has not yet been established.

Do not turn assumptions into facts.

--------------------------------
HYPOTHESES
--------------------------------

Provide plausible explanations based on the available evidence.

Do not present hypotheses as confirmed diagnoses.

Each hypothesis must include:

- explanation
- confidence between 0 and 1
- evidence explaining why it is plausible or why uncertainty remains

--------------------------------
QUESTIONS
--------------------------------

Questions should only be included when their answers could materially change the next decision.

Prioritize questions by information value.

Avoid asking unnecessary questions.

Ask the smallest number of questions necessary to move the investigation forward.

Questions must be directly addressed to the person.

Example:

GOOD:
"Does the fan spin when you press the power button?"

BAD:
"Ask the user if the fan spins."

--------------------------------
NEXT ACTION
--------------------------------

Determine the single most useful next step.

The next action should be concrete and directly usable.

Do not provide vague instructions such as:

"Troubleshoot the laptop."

Instead provide something actionable:

"Connect the laptop to an external monitor and check whether an image appears."

The action type must be one of:

- action
- questions
- escalation
- monitor
- resolved

Use:

action:
When there is a concrete step the person can perform.

questions:
When critical information must be gathered before a safe decision can be made.

escalation:
When professional assistance or another authority is appropriate.

monitor:
When no immediate intervention is necessary and the situation should be observed.

resolved:
When the available evidence indicates that the problem has been resolved.

--------------------------------
SAFETY
--------------------------------

Identify relevant safety considerations.

Do not encourage dangerous actions.

For hardware:

- Do not instruct someone to open dangerous electrical equipment.
- Do not instruct someone to bypass safety mechanisms.
- Do not recommend risky component manipulation when unnecessary.
- Consider warranty implications.
- Recommend professional repair when appropriate.

For other domains, apply appropriate safety reasoning.

--------------------------------
ESCALATION
--------------------------------

Explain when professional help or escalation is appropriate.

Do not automatically escalate every problem.

Escalate when:

- the required action is unsafe,
- the problem requires specialized equipment,
- the evidence strongly suggests hardware or system failure beyond safe user troubleshooting,
- legal, financial, medical, security, or other high-risk expertise is required,
- or continued troubleshooting could cause harm.

--------------------------------
REASSESSMENT
--------------------------------

When reassessing a case, compare:

1. What was previously known.
2. What action or questions were provided.
3. What the person actually did or answered.
4. What happened afterward.
5. What is now known.
6. What remains unknown.

Do not simply repeat the previous recommendation.

Use the new evidence to update the hypotheses and determine the next best step.

If the new evidence contradicts the previous hypothesis, lower its confidence or remove it.

If the new evidence establishes that the problem is resolved, use:

nextAction.type = "resolved"

Otherwise determine the next best action.

--------------------------------
OUTPUT FORMAT
--------------------------------

Return ONLY valid JSON.

Use exactly this structure:

{
  "problem": "short description of the problem",
  "summary": "direct, concise explanation of what is currently understood",
  "known": [
    "confirmed fact"
  ],
  "unknown": [
    "important missing information"
  ],
  "hypotheses": [
    {
      "explanation": "possible explanation",
      "confidence": 0.0,
      "evidence": "why this explanation is plausible or uncertain"
    }
  ],
  "questions": [
    "direct question addressed to the person"
  ],
  "nextAction": {
    "type": "action|questions|escalation|monitor|resolved",
    "action": "direct instruction or decision presented to the person",
    "reason": "why this is currently the best next step",
    "urgency": "low|medium|high"
  },
  "safety": [
    "direct safety consideration"
  ],
  "escalation": "direct explanation of when to seek additional help, or null"
}

IMPORTANT:
Every user-facing string must be suitable for direct display in the Paano interface.

Never output phrases such as:
"Ask the user..."
"Tell the user..."
"The user should..."
"The user needs to..."
"Have the user..."

Return the actual question or instruction instead.
`;

type Operation = "investigate" | "reassess";

type RequestBody = {
  operation?: Operation;
  situation?: string;
  actionTaken?: string;
  outcome?: string;
  context?: {
    previousResult?: unknown;
  };
};

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function extractText(message: unknown): string {
  if (!message || typeof message !== "object") {
    return "";
  }

  const msg = message as Record<string, unknown>;

  const content = msg.content;

  if (typeof content === "string") {
    return content.trim();
  }

  if (Array.isArray(content)) {
    const text = content
      .map((part) => {
        if (typeof part === "string") {
          return part;
        }

        if (part && typeof part === "object") {
          const item = part as Record<string, unknown>;

          if (typeof item.text === "string") {
            return item.text;
          }

          if (typeof item.content === "string") {
            return item.content;
          }
        }

        return "";
      })
      .filter(Boolean)
      .join("\n")
      .trim();

    if (text) {
      return text;
    }
  }

  if (typeof msg.reasoning === "string" && msg.reasoning.trim()) {
    return msg.reasoning.trim();
  }

  return "";
}

function extractJson(text: string): string {
  let cleaned = text.trim();

  // Remove markdown code fences.
  cleaned = cleaned
    .replace(/^```json\s*/i, "")
    .replace(/^```\s*/i, "")
    .replace(/\s*```$/i, "")
    .trim();

  // Direct JSON response.
  if (cleaned.startsWith("{") && cleaned.endsWith("}")) {
    return cleaned;
  }

  // Find the first balanced JSON object.
  const start = cleaned.indexOf("{");

  if (start === -1) {
    return "";
  }

  let depth = 0;
  let inString = false;
  let escaped = false;

  for (let i = start; i < cleaned.length; i++) {
    const char = cleaned[i];

    if (inString) {
      if (escaped) {
        escaped = false;
      } else if (char === "\\") {
        escaped = true;
      } else if (char === '"') {
        inString = false;
      }

      continue;
    }

    if (char === '"') {
      inString = true;
      continue;
    }

    if (char === "{") {
      depth++;
    } else if (char === "}") {
      depth--;

      if (depth === 0) {
        return cleaned.slice(start, i + 1);
      }
    }
  }

  return "";
}

function normalizeResult(input: unknown) {
  const result =
    input && typeof input === "object"
      ? (input as Record<string, unknown>)
      : {};

  const hypotheses = Array.isArray(result.hypotheses)
    ? result.hypotheses
        .filter(
          (item) => item && typeof item === "object"
        )
        .map((item) => {
          const hypothesis = item as Record<string, unknown>;

          const confidence =
            typeof hypothesis.confidence === "number"
              ? Math.max(0, Math.min(1, hypothesis.confidence))
              : 0;

          return {
            explanation:
              typeof hypothesis.explanation === "string"
                ? hypothesis.explanation
                : "",
            confidence,
            evidence:
              typeof hypothesis.evidence === "string"
                ? hypothesis.evidence
                : "",
          };
        })
    : [];

  const nextAction =
    result.nextAction &&
    typeof result.nextAction === "object"
      ? (result.nextAction as Record<string, unknown>)
      : {};

  const validTypes = [
    "action",
    "questions",
    "escalation",
    "monitor",
    "resolved",
  ];

  const type = validTypes.includes(
    String(nextAction.type)
  )
    ? String(nextAction.type)
    : "questions";

  return {
    problem:
      typeof result.problem === "string"
        ? result.problem
        : "",

    summary:
      typeof result.summary === "string"
        ? result.summary
        : "",

    known: Array.isArray(result.known)
      ? result.known.filter(
          (item): item is string => typeof item === "string"
        )
      : [],

    unknown: Array.isArray(result.unknown)
      ? result.unknown.filter(
          (item): item is string => typeof item === "string"
        )
      : [],

    hypotheses,

    questions: Array.isArray(result.questions)
      ? result.questions.filter(
          (item): item is string => typeof item === "string"
        )
      : [],

    nextAction: {
      type,
      action:
        typeof nextAction.action === "string"
          ? nextAction.action
          : "",

      reason:
        typeof nextAction.reason === "string"
          ? nextAction.reason
          : "",

      urgency:
        nextAction.urgency === "high" ||
        nextAction.urgency === "medium" ||
        nextAction.urgency === "low"
          ? nextAction.urgency
          : "medium",
    },

    safety: Array.isArray(result.safety)
      ? result.safety.filter(
          (item): item is string => typeof item === "string"
        )
      : [],

    escalation:
      typeof result.escalation === "string"
        ? result.escalation
        : null,
  };
}

async function callOpenRouter(
  apiKey: string,
  model: string,
  messages: Array<{
    role: "system" | "user";
    content: string;
  }>,
  maxRetries = 3
) {
  let lastError = "";

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const response = await fetch(OPENROUTER_URL, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
          "HTTP-Referer":
            process.env.NEXT_PUBLIC_SITE_URL ||
            "http://localhost:3000",
          "X-Title": "Paano",
        },
        body: JSON.stringify({
          model,
          messages,
          temperature: 0.2,
          response_format: {
            type: "json_object",
          },
        }),
      });

      const raw = await response.text();

      if (!response.ok) {
        lastError = raw;

        const retryable = [
          429,
          500,
          502,
          503,
          504,
        ].includes(response.status);

        if (retryable && attempt < maxRetries) {
          await sleep(1000 * Math.pow(2, attempt));
          continue;
        }

        if (response.status === 401) {
          throw new Error(
            "OpenRouter authentication failed. Check OPENROUTER_API_KEY."
          );
        }

        if (response.status === 402) {
          throw new Error(
            "OpenRouter account balance or credits are unavailable."
          );
        }

        if (response.status === 429) {
          throw new Error(
            "OpenRouter is rate limiting requests. Please try again shortly."
          );
        }

        if (response.status >= 500) {
          throw new Error(
            "OpenRouter is temporarily unavailable. Please try again."
          );
        }

        throw new Error(
          `OpenRouter request failed (${response.status}).`
        );
      }

      let data: unknown;

      try {
        data = JSON.parse(raw);
      } catch {
        throw new Error(
          "OpenRouter returned invalid JSON."
        );
      }

      const parsed =
        data && typeof data === "object"
          ? (data as Record<string, unknown>)
          : {};

      const choices = Array.isArray(parsed.choices)
        ? parsed.choices
        : [];

      if (!choices.length) {
        throw new Error(
          "OpenRouter returned no choices."
        );
      }

      const firstChoice = choices[0];

      if (
        !firstChoice ||
        typeof firstChoice !== "object"
      ) {
        throw new Error(
          "OpenRouter returned an invalid response."
        );
      }

      const choice =
        firstChoice as Record<string, unknown>;

      const message = choice.message;

      const text = extractText(message);

      if (!text) {
        throw new Error(
          "OpenRouter returned an empty response."
        );
      }

      const jsonText = extractJson(text);

      if (!jsonText) {
        throw new Error(
          "OpenRouter returned a response that could not be parsed as JSON."
        );
      }

      let result: unknown;

      try {
        result = JSON.parse(jsonText);
      } catch {
        throw new Error(
          "OpenRouter returned malformed JSON."
        );
      }

      return normalizeResult(result);
    } catch (error) {
      lastError =
        error instanceof Error
          ? error.message
          : "Unknown OpenRouter error.";

      if (attempt >= maxRetries) {
        throw new Error(lastError);
      }

      // Only retry transient/network errors.
      if (
        !/temporarily|rate|503|502|500|504|network|fetch/i.test(
          lastError
        )
      ) {
        throw new Error(lastError);
      }

      await sleep(1000 * Math.pow(2, attempt));
    }
  }

  throw new Error(
    lastError || "OpenRouter request failed."
  );
}

export async function POST(request: NextRequest) {
  try {
    const body =
      (await request.json()) as RequestBody;

    const operation =
      body.operation || "investigate";

    const situation =
      typeof body.situation === "string"
        ? body.situation.trim()
        : "";

    const apiKey =
      process.env.OPENROUTER_API_KEY;

    const model =
      process.env.OPENROUTER_MODEL ||
      "openrouter/free";

    if (!situation) {
      return NextResponse.json(
        {
          error:
            "Please describe what happened before starting an investigation.",
        },
        { status: 400 }
      );
    }

    if (!apiKey) {
      return NextResponse.json(
        {
          error:
            "OpenRouter is not configured. Add OPENROUTER_API_KEY to .env.local.",
        },
        { status: 500 }
      );
    }

    let userPrompt = "";

    if (operation === "reassess") {
      const previousResult =
        body.context?.previousResult ?? null;

      const actionTaken =
        body.actionTaken?.trim() || "";

      const outcome =
        body.outcome?.trim() || "";

      userPrompt = `
REASSESS THIS CASE.

Original situation:
${situation}

Previous case state:
${JSON.stringify(previousResult, null, 2)}

Previous recommended action:
${actionTaken || "None recorded."}

New information from the person:
${outcome || "No new information provided."}

Determine what the new evidence changes.

Do not merely repeat the previous recommendation.

Update:
- what is known
- what is unknown
- plausible explanations
- relevant questions
- the single best next action

Remember:
All questions and actions must be written directly to the person.

Never write:
"Ask the user..."
"Tell the user..."
"The user should..."

Write the actual question or instruction instead.
`;
    } else {
      userPrompt = `
INVESTIGATE THIS NEW CASE.

What happened:
${situation}

Determine:
1. What is currently known.
2. What is still unknown.
3. What explanations are plausible.
4. What information would most change the decision.
5. What the single best next step is.
6. Any relevant safety considerations.
7. Whether escalation is appropriate.

Do not ask unnecessary questions.

If critical information is missing, use nextAction.type = "questions" and provide the highest-value questions.

All questions and actions must be written directly to the person.

Never write:
"Ask the user..."
"Tell the user..."
"The user should..."

Write the actual question or instruction instead.
`;
    }

    const result = await callOpenRouter(
      apiKey,
      model,
      [
        {
          role: "system",
          content: SYSTEM_PROMPT,
        },
        {
          role: "user",
          content: userPrompt,
        },
      ]
    );

    return NextResponse.json(result);
  } catch (error) {
    console.error(
      "Paano investigation error:",
      error
    );

    const message =
      error instanceof Error
        ? error.message
        : "Investigation failed.";

    return NextResponse.json(
      {
        error: message,
      },
      { status: 500 }
    );
  }
}