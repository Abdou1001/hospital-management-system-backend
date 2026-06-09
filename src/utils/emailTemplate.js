// @Desc Reset password email template
export const resetPasswordTemplate = (code) => {

    return `

    <div style="
        background:#f3f4f6;
        padding:40px 20px;
        font-family:Arial,sans-serif;
    ">

        <div style="
            max-width:600px;
            margin:auto;
            background:white;
            border-radius:16px;
            overflow:hidden;
            box-shadow:0 5px 20px rgba(0,0,0,.08);
        ">

            <!-- Header -->

            <div style="
                background:#2563eb;
                padding:30px;
                text-align:center;
            ">

                <h1 style="
                    color:white;
                    margin:0;
                    font-size:28px;
                ">
                    نظام المستشفى
                </h1>

            </div>


            <!-- Body -->

            <div style="
                padding:40px 30px;
                direction:rtl;
                text-align:right;
            ">

                <h2 style="
                    color:#111827;
                    margin-bottom:20px;
                ">
                    إعادة تعيين كلمة المرور
                </h2>

                <p style="
                    color:#4b5563;
                    font-size:16px;
                    line-height:1.8;
                ">
                    لقد استلمنا طلبًا لإعادة تعيين كلمة المرور الخاصة بحسابك.
                </p>

                <p style="
                    color:#4b5563;
                    font-size:16px;
                    line-height:1.8;
                ">
                    استخدم رمز التحقق التالي لإكمال العملية:
                </p>


                <!-- Code -->

                <div style="
                    text-align:center;
                    margin:40px 0;
                ">

                    <span style="
                        display:inline-block;
                        background:#eff6ff;
                        color:#2563eb;
                        padding:18px 40px;
                        font-size:40px;
                        font-weight:bold;
                        letter-spacing:10px;
                        border-radius:12px;
                    ">
                        ${code}
                    </span>

                </div>


                <!-- Warning -->

                <div style="
                    background:#fef2f2;
                    color:#dc2626;
                    padding:15px;
                    border-radius:10px;
                    font-size:14px;
                    margin-top:20px;
                ">
                    هذا الرمز صالح لمدة 10 دقائق فقط.
                </div>

            </div>


            <!-- Footer -->

            <div style="
                border-top:1px solid #e5e7eb;
                padding:20px;
                text-align:center;
                font-size:13px;
                color:#6b7280;
            ">

                إذا لم تطلب إعادة تعيين كلمة المرور،
                يمكنك تجاهل هذه الرسالة بأمان.

            </div>

        </div>

    </div>

    `;
};