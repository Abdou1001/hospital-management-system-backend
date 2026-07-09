import axios from "axios";

const ACCESS_TOKEN = process.env.META_ACCESS_TOKEN;
const PHONE_NUMBER_ID = process.env.META_PHONE_NUMBER_ID;
const API_VERSION = process.env.META_API_VERSION;

/* =========================
   Send WhatsApp OTP
========================= */

export const sendOTP = async (phoneNumber, otp) => {
    try {
        const {data} = await axios.post(
            `https://graph.facebook.com/${API_VERSION}/${PHONE_NUMBER_ID}/messages`,
            {
                messaging_product: "whatsapp",
                to: phoneNumber,
                type: "template",
                template: {
                    name: "hello_world",
                    language: {
                        code: "en_US",
                    },
                    // components: [
                    //     {
                    //         type: "body",
                    //         parameters: [
                    //             {
                    //                 type: "text",
                    //                 text: otp,
                    //             },
                    //         ],
                    //     },
                    // ],
                },
            },
            
            {
                headers: {
                    Authorization: `Bearer ${ACCESS_TOKEN}`,
                    "Content-Type": "application/json",
                },
            },
        );

        return data;
    } catch (error) {
        console.log({
            ACCESS_TOKEN: ACCESS_TOKEN?.substring(0, 20),
            PHONE_NUMBER_ID,
            API_VERSION,
        });
        console.error(error.response?.data || error.message);
        throw new Error("فشل إرسال رسالة واتساب");
    }
};