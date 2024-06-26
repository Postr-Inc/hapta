//@ts-nocheck

import { pb } from "../../server";
import { TokenManager } from "../utils/jwt/JWT";
import { ErrorCodes, ErrorHandler } from "./ErrorHandler";

export default class AuthSate{
    pb: any;
    tokenManager: TokenManager;
    constructor(pb: any, tokenManager: TokenManager){
        this.pb = pb;
        this.tokenManager = tokenManager;
    }


    public adminAuth(data: any){
         
    }
    public refreshToken(token: string) {
        return this.tokenManager.refreshToken(token);
      }
    public async authenticateWithRecipet(rt: string){
        // a method that allows you to auth handshake without username password or email this is only for passkey devices!
        // recipetes should be generated by keys from the client - only client should know the key somehow make it secure

    }

    public async authUpdate(data: any){
   
        switch(true){
            case !data.data:
                 return {...new ErrorHandler(data).handle({code: ErrorCodes.FIELD_MISSING}), key: data.key, session: data.session, missing: 'record', isValid: false}
            case !data.token:
                return {
                    error: true,
                    message: 'token is required'
                }
            case !await this.tokenManager.isValid(data.token, true) ||  this.tokenManager.decodeToken(data.token).id !== data.data.id: 
                return {...new ErrorHandler(data).handle({code: ErrorCodes.INVALID_TOKEN}), key: data.key, session: data.session, isValid: false}
             
            default: 
                try { 
                let d = await pb.admins.client.collection('users').getOne(data.data.id) 
                return {error: false, message: 'success', key: data.key,  clientData: d, session: data.session}
        
                } catch (error) { 
                    return {...new ErrorHandler(error).handle({code: ErrorCodes.AUTHORIZATION_FAILED}), key: data.key, session: data.session}
                }
          }
    
    } 

    public async ChangePassword(data: any, msg){
           
    }

    public async authWithPassword(data: any){
        switch(true){
            case !data.email || !data.username:
                return {
                    error: true,
                    message: 'email or username are required',
                    key: data.key
                }
            case !data.session:
                return {
                    error:true,
                    ...new ErrorHandler(data).handle({code: ErrorCodes.NO_SESSION_GIVEN}), 
                    key: data.key
                }

            case !data.password:
                return {
                    error: true,
                    message: 'password is required',
                    key: data.key
                }
            default:
                try {
                    let res = await pb.admins.client.collection('users').authWithPassword(data.email || data.username, data.password)
                    let token = await this.tokenManager.sign({id:res.record.id, session: data.session}, await this.tokenManager.generateSigningKey(res.record.id, true) as string);
                    res['token'] = token as string;
                    return {error: false, message: 'success', key: data.key, clientData: res}
                } catch (error) {
                    return {error: true, message: error.message, key: data.key}
                }

        }
    }

    async oauth(data: any, msg: any){
        
    let session = data.session
    data = data.data

    try {
        let res  = await pb.admins.client.collection('users').authWithOAuth2({
            provider: data.provider,
            createData: {
             bio: "I am new to Postr!",
             followers: [],
             following: [],
             devices: [], 
            },
            redirectUrl: data.redirectUrl,
            urlCallback: (url) => { 
               msg({
                    type: 'oauth',
                    key:'oauth',
                    data: {
                        url: url
                    },
                    session: session
                 
                })
            },
           }) 
  
        let newtoken = this.tokenManager.generateToken({id: res.record.id, session: session},  900) // 15 minutes
        res['token'] = newtoken as string; 
        global.shouldLog && console.log(`User ${res.record.id} logged in`); 
        msg({type:'oauth', key:'oauth', clientData:res, session: session}) 
      } catch (error) {  
        console.log(error)
        msg({...new ErrorHandler(error).handle({code:  ErrorCodes.AUTHORIZATION_FAILED}), session: session, key: 'oauth'})  
      }
    }

    async checkUsername(username: string){
        try {
            let res = await pb.admins.client.collection('users').getFirstListItem(`username = "${username}"`)
            return res ? true : false
        } catch (error) {
            return false
        }
    }
    
}
 
 