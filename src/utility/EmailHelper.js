const nodemailer = require('nodemailer');

const EmailSend = async (EmailTo, EmailText, EmailSubject) => {

    // ⚠️ REPLACE these placeholders with your actual Gmail address and App Password
    const SENDER_EMAIL = "sayem.shuvo999@gmail.com";
    const APP_PASSWORD = "gahy atpa qqpg lsxj";

    try {
        let transport = nodemailer.createTransport({
            host: "smtp.gmail.com", // 1. Use Gmail's SMTP host
            port: 465,              // 2. Use the secure SSL/TLS port 465
            secure: true,           // 3. Set 'secure' to true for port 465
            auth: {
                user: SENDER_EMAIL,
                // 4. IMPORTANT: Use the App Password generated from your Google Security Settings
                pass: APP_PASSWORD
            }
        });

        let mailOption = {
            from: `MERN Ecommerce Solution <${SENDER_EMAIL}>`, // Use your Gmail address here
            to: EmailTo,
            subject: EmailSubject,
            text: EmailText
        };

        const result = await transport.sendMail(mailOption);
        return result;

    } catch (error) {
        console.error("Error sending email via Gmail:", error);
        throw new Error(`Failed to send email: ${error.message}`);
    }
}

module.exports = EmailSend;