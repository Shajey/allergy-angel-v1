import { getOpenAIClient } from "../api/_lib/openaiClient.js";

async function main() {
  try {
    const client = getOpenAIClient();
    
    console.log("Sending 'Hello' message to gpt-4o-mini...");
    
    const response = await client.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "user",
          content: "Hello"
        }
      ]
    });
    
    console.log("\nResponse received:");
    console.log(JSON.stringify(response, null, 2));
    
    const message = response.choices[0]?.message?.content;
    if (message) {
      console.log("\nMessage content:", message);
    }
  } catch (error) {
    console.error("Error:", error);
    process.exit(1);
  }
}

main();
