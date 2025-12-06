const EmailSend = require("../utility/EmailHelper");
const UserModel = require("../models/UserModel")
const ProfileModel = require("../models/ProfileModel")

const { EncodeToken } = require("../utility/TokenHelper");

const EMAIL_REGEX = /\S+@\S+\.\S+/;

const normalizeEmail = (value = "") => value.trim().toLowerCase();

const UserOTPService = async (req) => {
    try {
        const incomingEmail = req.params?.email || "";
        const email = normalizeEmail(incomingEmail);

        if (!EMAIL_REGEX.test(email)) {
            return { status: "fail", message: "Please provide a valid email address." };
        }

        const code = Math.floor(100000 + Math.random() * 900000).toString();
        const EmailText = `Your verification code is ${code}`;
        const EmailSubject = 'Email Verification';

        await EmailSend(email, EmailText, EmailSubject);

        await UserModel.updateOne(
            { email },
            { $set: { email, otp: code } },
            { upsert: true }
        );

        return { status: "success", message: "A 6-digit verification code has been sent to your email." };
    } catch (e) {
        return { status: "fail", message: e.message || "Unable to send verification code." };
    }
}

const VerifyOTPService = async (req) => {
    try {
        const incomingEmail = req.params?.email || "";
        const email = normalizeEmail(incomingEmail);
        const otp = (req.params?.otp || "").trim();

        if (!EMAIL_REGEX.test(email) || otp.length !== 6) {
            return { status: "fail", message: "Invalid email or verification code." };
        }

        const user = await UserModel.findOne({ email, otp }).select('_id email');

        if (!user) {
            return { status: "fail", message: "Invalid or expired verification code." };
        }

        const token = EncodeToken(email, user['_id'].toString());
        await UserModel.updateOne({ _id: user['_id'] }, { $set: { otp: "0" } });

        return { status: "success", message: "Verification successful.", token };
    } catch (e) {
        return { status: "fail", message: "Unable to verify the provided code." };
    }
}




const SaveProfileService = async (req) => {
    try {
        let user_id = req.headers.user_id;
        let reqBody = req.body;
        reqBody.userID = user_id;
        await ProfileModel.updateOne({ userID: user_id }, { $set: reqBody }, { upsert: true })
        return { status: "success", message: "Profile Save Success" }
    } catch (e) {
        return { status: "fail", message: "Something Went Wrong" }
    }
}





const ReadProfileService = async (req) => {
    try {
        let user_id = req.headers.user_id;
        let result = await ProfileModel.find({ userID: user_id })
        return { status: "success", data: result }
    } catch (e) {
        return { status: "fail", message: "Something Went Wrong" }
    }
}


module.exports = {
    UserOTPService,
    VerifyOTPService,
    SaveProfileService,
    ReadProfileService
}

