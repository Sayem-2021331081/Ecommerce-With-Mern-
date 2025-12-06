import create from 'zustand';
import axios from "axios";
import { getEmail, setEmail, clearEmail, unauthorized } from "../utility/utility.js";

const initialLoginForm = { email: "" };
const initialOTPForm = { otp: "" };
const initialProfileForm = {
    cus_add: "",
    cus_city: "",
    cus_country: "",
    cus_fax: "",
    cus_name: "",
    cus_phone: "",
    cus_postcode: "",
    cus_state: "",
    ship_add: "",
    ship_city: "",
    ship_country: "",
    ship_name: "",
    ship_phone: "",
    ship_postcode: "",
    ship_state: ""
};

const clone = (object) => ({ ...object });

const parseAxiosError = (error, fallbackMessage) => {
    if (error?.response?.data) {
        return error.response.data;
    }
    return { status: "fail", message: fallbackMessage };
};

const UserStore = create((set, get) => ({
    isFormSubmit: false,
    authStatus: "unknown",

    isLogin: () => get().authStatus === "authenticated",

    AuthStatusRequest: async () => {
        try {
            const res = await axios.get(`/api/v1/AuthStatus`);
            set({ authStatus: "authenticated" });
            return res.data;
        } catch (error) {
            if (error?.response?.status === 401) {
                set({ authStatus: "guest" });
                return { status: "fail", message: "Unauthorized" };
            }
            return parseAxiosError(error, "Unable to check login status right now.");
        }
    },

    LoginFormData: clone(initialLoginForm),
    LoginFormOnChange: (name, value) => {
        set((state) => ({
            LoginFormData: {
                ...state.LoginFormData,
                [name]: value
            }
        }));
    },
    UserOTPRequest: async (email) => {
        const sanitizedEmail = (email || "").trim();
        if (!sanitizedEmail) {
            return { status: "fail", message: "Email address is required." };
        }
        try {
            set({ isFormSubmit: true });
            const res = await axios.get(`/api/v1/UserOTP/${encodeURIComponent(sanitizedEmail)}`);
            if (res?.data?.status === "success") {
                setEmail(sanitizedEmail);
                set({ OTPFormData: clone(initialOTPForm) });
            }
            return res.data;
        } catch (error) {
            return parseAxiosError(error, "Unable to send verification code right now.");
        } finally {
            set({ isFormSubmit: false });
        }
    },

    UserLogoutRequest: async () => {
        try {
            set({ isFormSubmit: true });
            const res = await axios.get(`/api/v1/UserLogout`);
            clearEmail();
            set({ authStatus: "guest" });
            return res.data;
        } catch (error) {
            return parseAxiosError(error, "Unable to logout right now.");
        } finally {
            set({ isFormSubmit: false });
        }
    },

    OTPFormData: clone(initialOTPForm),
    OTPFormOnChange: (name, value) => {
        set((state) => ({
            OTPFormData: {
                ...state.OTPFormData,
                [name]: value
            }
        }));
    },
    VerifyLoginRequest: async (otp) => {
        const sanitizedOtp = (otp || "").trim();
        const email = getEmail();
        if (!email) {
            return { status: "fail", message: "Please request a verification code first." };
        }
        if (!sanitizedOtp) {
            return { status: "fail", message: "Please enter the verification code." };
        }
        try {
            set({ isFormSubmit: true });
            const res = await axios.get(`/api/v1/VerifyLogin/${encodeURIComponent(email)}/${encodeURIComponent(sanitizedOtp)}`);
            if (res?.data?.status === "success") {
                clearEmail();
                set({
                    OTPFormData: clone(initialOTPForm),
                    LoginFormData: clone(initialLoginForm),
                    authStatus: "authenticated"
                });
            }
            return res.data;
        } catch (error) {
            return parseAxiosError(error, "Unable to verify the code right now.");
        } finally {
            set({ isFormSubmit: false });
        }
    },

    ProfileForm: { ...initialProfileForm },
    ProfileFormChange: (name, value) => {
        set((state) => ({
            ProfileForm: {
                ...state.ProfileForm,
                [name]: value
            }
        }));
    },

    ProfileDetails: null,
    ProfileDetailsRequest: async () => {
        try {
            const res = await axios.get(`/api/v1/ReadProfile`);
            if (res.data['data'].length > 0) {
                set({ ProfileDetails: res.data['data'][0] });
                set({ ProfileForm: res.data['data'][0] });
            } else {
                set({ ProfileDetails: [] });
            }
        } catch (e) {
            unauthorized(e?.response?.status);
        }
    },

    ProfileSaveRequest: async (PostBody) => {
        try {
            set({ ProfileDetails: null });
            const res = await axios.post(`/api/v1/UpdateProfile`, PostBody);
            return res.data['status'] === "success";
        } catch (e) {
            unauthorized(e?.response?.status);
            return false;
        }
    }

}));

export default UserStore;