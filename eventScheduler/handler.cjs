const path = require('path');

module.exports.handler = async (event) => {
    console.log("--- EXECUTION STARTED ---");
    console.log("Event Received:", JSON.stringify(event));

    try {
        // 1. Dynamically import index.js using an absolute path
        // This prevents "module not found" errors in the Lambda environment
        const indexPath = path.resolve(__dirname, 'index.js');
        const { main } = await import(indexPath);

        // 2. Run your main booking logic
        // We pass the 'event' to main() so index.js can see the chatId/action
        const result = await main(event);

        console.log("Main logic finished successfully.");

        return {
            statusCode: 200,
            body: JSON.stringify({ 
                message: "Success", 
                data: result 
            }),
        };

    } catch (error) {
        console.error("!!! LAMBDA CRASHED !!!");
        console.error("Error Name:", error.name);
        console.error("Error Message:", error.message);
        console.log("Stack Trace:", error.stack);

        return {
            statusCode: 500,
            body: JSON.stringify({ 
                error: error.message,
                stack: error.stack 
            }),
        };
    }
};
