import { SchedulerClient, CreateScheduleCommand } from "@aws-sdk/client-scheduler";

const client = new SchedulerClient({ region: "us-east-1" });

export const handler = async (event) => {
    // 1. Парсим входящее сообщение от Telegram
    const body = event.body ? JSON.parse(event.body) : {};
    const chatId = body.message?.chat?.id || 13039****4; // Твой ID как фоллбэк
    const userText = body.message?.text?.toLowerCase();

    if (userText === 'book') {
        try {
            // //2. Рассчитываем время (завтра в 8:43 AM Austin = 13:43 UTC)

            const date = new Date(new Date().toLocaleString("en-US", {timeZone: "America/Chicago"}));
            date.setDate(date.getDate()+1);
            date.setHours(8, 44, 0, 0); 
            const scheduleTime = date.toISOString().split('.')[0]; 

            // 3. Создаем задачу в EventBridge Scheduler
            await client.send(new CreateScheduleCommand({
                Name: `TennisBooking_${Date.now()}`,
                ScheduleExpression: `at(${scheduleTime})`,
                FlexibleTimeWindow: { Mode: "OFF" },
                ScheduleExpressionTimezone: "America/Chicago",
                Target: {
                    // Убедись, что эти переменные прописаны в Configuration -> Environment Variables
                    Arn: "arn:aws:lambda:us-east-1:439289764752:function:Tennis-Booker-Script",
                    RoleArn: "arn:aws:iam::439289764752:role/service-role/Tennis-Trigger-Bot-role-rl6l3vfq"
                },
                ActionAfterCompletion: "DELETE"
            }));

            const prettyDate = date.toLocaleString('en-US', {
                weekday: 'long',
                year: 'numeric',
                month: 'long',
                day: 'numeric',
                hour: 'numeric',
                minute: '2-digit',
                hour12: true
            });

            // 4. Отправляем ответ в Telegram через твой fetch
            await fetch(`https://api.telegram.org/bot8*********:*************iPZc/sendMessage`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    chat_id: 1303900724,
                    text: `✅ Ок! I scheduled a booking of the tennis court tomorrow at ${prettyDate}.`
                })
            });

        } catch (error) {
            console.error("Error details:", error);
            
            // Сообщаем об ошибке в Telegram, если что-то пошло не так
            await fetch(`https://api.telegram.org/bot8*********:*************iPZc/sendMessage`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    chat_id: 130*******, // UPDATE ME
                    text: `❌Error: ${error.message}`
                })
            });
        }
    }

    return { 
        statusCode: 200,
        body: JSON.stringify({ ok: true }) 
    };
};
