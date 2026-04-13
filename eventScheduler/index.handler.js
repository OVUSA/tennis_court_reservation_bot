// index.handler.js

exports.handler = async () => {
    try {
      const { main } = await import("./index.js");
      const result = await main();
  
      return {
        statusCode: 200,
        body: JSON.stringify({ message: "Success", data: result }),
      };
    } catch (error) {
      console.error("Lambda execution failed:", error);
      return {
        statusCode: 500,
        body: JSON.stringify({ error: error.message }),
      };
    }
  };
  
