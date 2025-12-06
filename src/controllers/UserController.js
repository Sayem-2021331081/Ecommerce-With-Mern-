const {UserOTPService,VerifyOTPService,SaveProfileService,ReadProfileService} = require("../services/UserServices");

const ONE_DAY_MS = 24 * 60 * 60 * 1000;
const baseCookieOption = {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax'
};

exports.UserOTP=async (req,res)=>{
    let result=await UserOTPService(req)
    return res.status(200).json(result)
}


exports.VerifyLogin=async (req,res)=>{
    let result=await VerifyOTPService(req)

    if(result['status']==="success"){
        let cookieOption={
            ...baseCookieOption,
            expires:new Date(Date.now()+ONE_DAY_MS)
        }
        res.cookie('token',result['token'],cookieOption)
    }

    return res.status(200).json(result)
}


exports.UserLogout=async (req,res)=>{
    let cookieOption={
        ...baseCookieOption,
        expires:new Date(Date.now()-ONE_DAY_MS)
    }
    res.cookie('token',"",cookieOption)
    return res.status(200).json({status:"success"})
}


exports.CreateProfile=async (req,res)=>{
    let result=await SaveProfileService(req)
    return res.status(200).json(result)
}


exports.UpdateProfile=async (req,res)=>{
    let result=await SaveProfileService(req)
    return res.status(200).json(result)
}


exports.ReadProfile=async (req,res)=>{
    let result=await ReadProfileService(req)
    return res.status(200).json(result)
}


exports.AuthStatus = async (req, res) => {
    return res.status(200).json({
        status: "success",
        data: {
            email: req.headers.email
        }
    });
}

