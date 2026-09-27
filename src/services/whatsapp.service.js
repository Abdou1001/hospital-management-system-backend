import axios from "axios";

const TEXTBEE_API_KEY = process.env.TEXTBEE_API_KEY;

export const sendOTP = async (phoneNumber, otp) => {
    try {
        const {data} = await axios.post(
            "https://api.textbee.dev/api/v1/gateway/send-sms",
            {
                recipients: [phoneNumber],
                message: `رمز التحقق الخاص بك هو: ${otp}`,
            },
            {
                headers: {
                    "x-api-key": TEXTBEE_API_KEY,
                    "Content-Type": "application/json",
                },
            },
        );

        console.log("TextBee OTP sent:", data);

        return data;
    } catch (error) {
        console.error("TextBee OTP Error:", {
            message: error.message,
            status: error.response?.status,
            data: error.response?.data,
        });

        throw new Error("فشل إرسال رمز التحقق");
    }
};

// import axios from "axios";

// const ACCESS_TOKEN = process.env.META_ACCESS_TOKEN;
// const PHONE_NUMBER_ID = process.env.META_PHONE_NUMBER_ID;
// const API_VERSION = process.env.META_API_VERSION;

// /* =========================
//    Send WhatsApp OTP
// ========================= */

// export const sendOTP = async (phoneNumber, otp) => {
//     try {
//         const {data} = await axios.post(
//             `https://graph.facebook.com/${API_VERSION}/${PHONE_NUMBER_ID}/messages`,
//             {
//                 messaging_product: "whatsapp",
//                 to: phoneNumber,
//                 type: "template",
//                 template: {
//                     name: "hello_world",
//                     language: {
//                         code: "en_US",
//                     },
//                     // components: [
//                     //     {
//                     //         type: "body",
//                     //         parameters: [
//                     //             {
//                     //                 type: "text",
//                     //                 text: otp,
//                     //             },
//                     //         ],
//                     //     },
//                     // ],
//                 },
//             },

//             {
//                 headers: {
//                     Authorization: `Bearer ${ACCESS_TOKEN}`,
//                     "Content-Type": "application/json",
//                 },
//             },
//         );

//         return data;
//     } catch (error) {
//         console.log({
//             ACCESS_TOKEN: ACCESS_TOKEN?.substring(0, 20),
//             PHONE_NUMBER_ID,
//             API_VERSION,
//         });
//         console.error(error.response?.data || error.message);
//         throw new Error("فشل إرسال رسالة واتساب");
//     }
// };
