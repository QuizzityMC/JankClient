type translation={
    [key:string]:string|translation
};
let res:()=>unknown=()=>{};
class I18n{
    static lang:string;
    static translations:translation[]=[];
    static done=new Promise<void>((res2,_reject)=>{
        res=res2;
    });
    static async create(json:translation|string,lang:string){
        if(typeof json === "string"){
            json=await (await fetch(json)).json() as translation;
        }
        const translations:translation[]=[];
        let translation=json[lang];
        if(!translation){
            translation=json[lang[0]+lang[1]];
            if(!translation){
                console.error(lang+" does not exist in the translations");
                translation=json["en"];
                lang="en";
            }
        }
        translations.push(await this.toTranslation(translation,lang));
        if(lang!=="en"){
            translations.push(await this.toTranslation(json["en"],"en"))
        }
        this.lang=lang;
        this.translations=translations;
        res();
    }
    static getTranslation(msg:string,...params:string[]):string{
        let str:string|undefined;
        const path=msg.split(".");
        for(const json of this.translations){
            let jsont:string|translation=json;
            for(const thing of path){
                if(typeof jsont !== "string" && jsont!==undefined){
                    jsont=jsont[thing];

                }else{
                    jsont=json;
                    break;
                }
            }

            if(typeof jsont === "string"){
                str=jsont;
                break;
            }
        }
        if(str){
            return this.fillInBlanks(str,params);
        }else{
            throw new Error(msg+" not found")
        }
    }
    static fillInBlanks(msg:string,params:string[]):string{
        //thanks to geotale for the regex
        msg=msg.replace(/\$\d+/g,(match) => {
            const number=Number(match.slice(1));
            if(params[number-1]){
                return params[number-1];
            }else{
                return match;
            }
        });
        msg=msg.replace(/{{(.+?)}}/g,
            (str, match:string) => {
                const [op,strsSplit]=this.fillInBlanks(match,params).split(":");
                const [first,...strs]=strsSplit.split("|");
                switch(op.toUpperCase()){
                    case "PLURAL":{
                        const numb=Number(first);
                        if(numb===0){
                            return strs[strs.length-1];
                        }
                        return strs[Math.min(strs.length-1,numb-1)];
                    }
                    case "GENDER":{
                        if(first==="male"){
                            return strs[0];
                        }else if(first==="female"){
                            return strs[1];
                        }else if(first==="neutral"){
                            if(strs[2]){
                                return strs[2];
                            }else{
                                return strs[0];
                            }
                        }
                    }
                }
                return str;
            }
        );

        return msg;
    }
    private static async toTranslation(trans:string|translation,lang:string):Promise<translation>{
        if(typeof trans==='string'){
            return this.toTranslation((await (await fetch(trans)).json() as translation)[lang],lang);
        }else{
            return trans;
        }
    }
    static options(){
        return ["en","ru","tr"]
    }
    static setLanguage(lang:string){
        if(this.options().indexOf(userLocale)!==-1){
            localStorage.setItem("lang",lang);
            I18n.create("/translations/en.json",lang);
        }
    }
}

let userLocale = navigator.language.slice(0,2) || "en";
if(I18n.options().indexOf(userLocale)===-1){
    userLocale="en";
}
const storage=localStorage.getItem("lang");
if(storage){
    userLocale=storage;
}else{
    localStorage.setItem("lang",userLocale)
}
I18n.create("/translations/en.json",userLocale);

export{I18n};
