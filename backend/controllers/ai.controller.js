const client = require('../config/openai');

exports.audit = async (req, res) => {
    try {
        const response = await client.chat.completions.create({
            messages: [{ role: "system", content: "Analyze code, identify bugs, return plain text log." }, { role: "user", content: req.body.codeBuffer }],
            model: "gemini-3.6-flash", temperature: 0.1, max_tokens: 150
        });
        res.json({ auditLog: response.choices[0].message.content });
    } catch (error) { res.json({ auditLog: `> [SYSTEM ERROR] AI failure.` }); }
};

exports.chat = async (req, res) => {
    try {
        const { promptMessage, history, codeBuffer } = req.body;

        let apiMessages = [
            {
                role: "system",
                content: `You are an advanced AI Copilot inside a professional collaborative IDE. Reply as plain text console output. Always keep track of previous code requests and maintain thread history context seamlessly.\n\nHere is the current code in the active file:\n\`\`\`\n${codeBuffer || ""}\n\`\`\``
            }
        ];

        if (history && Array.isArray(history)) {
            apiMessages = [...apiMessages, ...history];
        } else {
            apiMessages.push({ role: "user", content: promptMessage });
        }

        const response = await client.chat.completions.create({
            messages: apiMessages,
            model: "gemini-3.6-flash", temperature: 0.5, max_tokens: 2048
        });
        res.json({ reply: response.choices[0].message.content });
    } catch (error) { res.json({ reply: `[SYSTEM EXCEPTION] AI failure.` }); }
};

exports.execute = async (req, res) => {
    try {
        const { language, codeBuffer, customInput } = req.body;

        let userContent = `Language: ${language}\nCode:\n${codeBuffer}`;
        if (customInput && customInput.trim() !== "") {
            userContent += `\n\nStandard Input (stdin):\n${customInput}`;
        }

        const response = await client.chat.completions.create({
            messages: [
                {
                    role: "system",
                    content: "You are a strict code compiler and batch execution terminal. The user will provide code and optionally standard input (stdin).\n\nCRITICAL RULES:\n1. If there are syntax errors, output ONLY the standard raw compiler error message.\n2. If the code is correct, simulate its execution.\n3. Use the provided Standard Input for any input requests (like cin, scanf, input(), Scanner).\n4. FATAL RULE: If the code requires input (e.g. cin) to proceed, but the Standard Input provided is EMPTY or has INSUFFICIENT values, YOU MUST NOT hallucinate or guess values. You MUST immediately stop execution and output EXACTLY: '[Runtime Error] EOFError: Program required user input but Standard Input (stdin) was empty or exhausted.'\n5. Output ONLY the exact execution stdout. Do NOT provide explanations, do NOT fix the code, and do NOT wrap the output in markdown backticks. Behave exactly like a raw linux terminal."
                },
                {
                    role: "user",
                    content: userContent
                }
            ],
            model: "gemini-3.6-flash",
            temperature: 0.0,
            max_tokens: 500
        });

        let finalOutput = response.choices[0].message.content;

        if (finalOutput.startsWith('```')) {
            finalOutput = finalOutput.replace(/```[a-z]*\n/g, '').replace(/```/g, '');
        }

        res.json({ output: finalOutput.trim() || "Execution complete. No output." });
    } catch (error) {
        res.status(500).json({ error: "Virtual Execution Engine Failed." });
    }
};
