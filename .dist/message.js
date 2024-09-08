import { Contextmenu } from "./contextmenu.js";
import { User } from "./user.js";
import { Member } from "./member.js";
import { MarkDown } from "./markdown.js";
import { Embed } from "./embed.js";
import { File } from "./file.js";
import { SnowFlake } from "./snowflake.js";
import { Emoji } from "./emoji.js";
import { Dialog } from "./dialog.js";
class Message extends SnowFlake {
    static contextmenu = new Contextmenu("message menu");
    owner;
    headers;
    embeds;
    author;
    mentions;
    mention_roles;
    attachments; //probably should be its own class tbh, should be Attachments[]
    message_reference;
    type;
    timestamp;
    content;
    static del;
    static resolve;
    /*
    weakdiv:WeakRef<HTMLDivElement>;
    set div(e:HTMLDivElement){
        if(!e){
            this.weakdiv=null;
            return;
        }
        this.weakdiv=new WeakRef(e);
    }
    get div(){
        return this.weakdiv?.deref();
    }
    //*/
    div;
    member;
    reactions;
    static setup() {
        this.del = new Promise(_ => {
            this.resolve = _;
        });
        Message.setupcmenu();
    }
    static setupcmenu() {
        Message.contextmenu.addbutton("Copy raw text", function () {
            navigator.clipboard.writeText(this.content.rawString);
        });
        Message.contextmenu.addbutton("Reply", function () {
            this.channel.setReplying(this);
        });
        Message.contextmenu.addbutton("Copy message id", function () {
            navigator.clipboard.writeText(this.id);
        });
        Message.contextmenu.addsubmenu("Add reaction", function (arg, e) {
            Emoji.emojiPicker(e.x, e.y, this.localuser).then(_ => {
                this.reactionToggle(_);
            });
        });
        Message.contextmenu.addbutton("Edit", function () {
            this.setEdit();
        }, null, function () {
            return this.author.id === this.localuser.user.id;
        });
        Message.contextmenu.addbutton("Delete message", function () {
            this.delete();
        }, null, function () {
            return this.canDelete();
        });
    }
    setEdit() {
        this.channel.editing = this;
        const markdown = document.getElementById("typebox")["markdown"];
        markdown.txt = this.content.rawString.split("");
        markdown.boxupdate(document.getElementById("typebox"));
    }
    constructor(messagejson, owner) {
        super(messagejson.id);
        this.owner = owner;
        this.headers = this.owner.headers;
        this.giveData(messagejson);
        this.owner.messages.set(this.id, this);
    }
    reactionToggle(emoji) {
        let remove = false;
        for (const thing of this.reactions) {
            if (thing.emoji.name === emoji) {
                remove = thing.me;
                break;
            }
        }
        let reactiontxt;
        if (emoji instanceof Emoji) {
            reactiontxt = `${emoji.name}:${emoji.id}`;
        }
        else {
            reactiontxt = encodeURIComponent(emoji);
        }
        fetch(`${this.info.api}/channels/${this.channel.id}/messages/${this.id}/reactions/${reactiontxt}/@me`, {
            method: remove ? "DELETE" : "PUT",
            headers: this.headers
        });
    }
    giveData(messagejson) {
        const func = this.channel.infinite.snapBottom();
        for (const thing of Object.keys(messagejson)) {
            if (thing === "attachments") {
                this.attachments = [];
                for (const thing of messagejson.attachments) {
                    this.attachments.push(new File(thing, this));
                }
                continue;
            }
            else if (thing === "content") {
                this.content = new MarkDown(messagejson[thing], this.channel);
                continue;
            }
            else if (thing === "id") {
                continue;
            }
            else if (thing === "member") {
                Member.new(messagejson.member, this.guild).then(_ => {
                    this.member = _;
                });
                continue;
            }
            else if (thing === "embeds") {
                this.embeds = [];
                for (const thing in messagejson.embeds) {
                    console.log(thing, messagejson.embeds);
                    this.embeds[thing] = new Embed(messagejson.embeds[thing], this);
                }
                continue;
            }
            this[thing] = messagejson[thing];
        }
        if (messagejson.reactions?.length) {
            console.log(messagejson.reactions, ":3");
        }
        this.author = new User(messagejson.author, this.localuser);
        for (const thing in messagejson.mentions) {
            this.mentions[thing] = new User(messagejson.mentions[thing], this.localuser);
        }
        if (!this.member && this.guild.id !== "@me") {
            this.author.resolvemember(this.guild).then(_ => {
                this.member = _;
            });
        }
        if (this.mentions.length || this.mention_roles.length) { //currently mention_roles isn't implemented on the spacebar servers
            console.log(this.mentions, this.mention_roles);
        }
        if (this.mentionsuser(this.localuser.user)) {
            console.log(this);
        }
        if (this.div) {
            this.generateMessage();
        }
        func();
    }
    canDelete() {
        return this.channel.hasPermission("MANAGE_MESSAGES") || this.author === this.localuser.user;
    }
    get channel() {
        return this.owner;
    }
    get guild() {
        return this.owner.guild;
    }
    get localuser() {
        return this.owner.localuser;
    }
    get info() {
        return this.owner.info;
    }
    messageevents(obj) {
        const func = Message.contextmenu.bindContextmenu(obj, this, undefined);
        this.div = obj;
        obj.classList.add("messagediv");
    }
    deleteDiv() {
        if (!this.div)
            return;
        try {
            this.div.remove();
            this.div = undefined;
        }
        catch (e) {
            console.error(e);
        }
    }
    mentionsuser(userd) {
        if (userd instanceof User) {
            return this.mentions.includes(userd);
        }
        else if (userd instanceof Member) {
            return this.mentions.includes(userd.user);
        }
    }
    getimages() {
        const build = [];
        for (const thing of this.attachments) {
            if (thing.content_type.startsWith("image/")) {
                build.push(thing);
            }
        }
        return build;
    }
    async edit(content) {
        return await fetch(this.info.api + "/channels/" + this.channel.id + "/messages/" + this.id, {
            method: "PATCH",
            headers: this.headers,
            body: JSON.stringify({ content })
        });
    }
    delete() {
        fetch(`${this.info.api}/channels/${this.channel.id}/messages/${this.id}`, {
            headers: this.headers,
            method: "DELETE",
        });
    }
    deleteEvent() {
        if (this.div) {
            this.div.innerHTML = "";
            this.div = undefined;
        }
        const prev = this.channel.idToPrev.get(this.id);
        const next = this.channel.idToNext.get(this.id);
        if (prev) {
            this.channel.idToPrev.delete(this.id);
        }
        if (next) {
            this.channel.idToNext.delete(this.id);
        }
        if (prev && next) {
            this.channel.idToPrev.set(next, prev);
            this.channel.idToNext.set(prev, next);
        }
        if (prev) {
            const prevmessage = this.channel.messages.get(prev);
            if (prevmessage) {
                prevmessage.generateMessage();
            }
        }
        if (this.channel.lastmessage === this) {
            if (prev) {
                this.channel.lastmessage = this.channel.messages.get(prev);
            }
            else {
                this.channel.lastmessage = undefined;
            }
        }
    }
    reactdiv;
    blockedPropigate() {
        const previd = this.channel.idToPrev.get(this.id);
        if (!previd) {
            this.generateMessage();
            return;
        }
        const premessage = this.channel.messages.get(previd);
        if (premessage?.author === this.author) {
            premessage.blockedPropigate();
        }
        else {
            this.generateMessage();
        }
    }
    generateMessage(premessage, ignoredblock = false) {
        if (!this.div)
            return;
        if (!premessage) {
            premessage = this.channel.messages.get(this.channel.idToPrev.get(this.id));
        }
        const div = this.div;
        if (this === this.channel.replyingto) {
            div.classList.add("replying");
        }
        div.innerHTML = "";
        const build = document.createElement("div");
        build.classList.add("flexltr", "message");
        div.classList.remove("zeroheight");
        if (this.author.relationshipType === 2) {
            if (ignoredblock) {
                if (premessage?.author !== this.author) {
                    const span = document.createElement("span");
                    span.textContent = "You have this user blocked, click to hide these messages.";
                    div.append(span);
                    span.classList.add("blocked");
                    span.onclick = _ => {
                        const scroll = this.channel.infinite.scrollTop;
                        let next = this;
                        while (next?.author === this.author) {
                            next.generateMessage();
                            next = this.channel.messages.get(this.channel.idToNext.get(next.id));
                        }
                        if (this.channel.infinite.div && scroll) {
                            this.channel.infinite.div.scrollTop = scroll;
                        }
                    };
                }
            }
            else {
                div.classList.remove("topMessage");
                if (premessage?.author === this.author) {
                    div.classList.add("zeroheight");
                    premessage.blockedPropigate();
                    div.appendChild(build);
                    return div;
                }
                else {
                    build.classList.add("blocked", "topMessage");
                    const span = document.createElement("span");
                    let count = 1;
                    let next = this.channel.messages.get(this.channel.idToNext.get(this.id));
                    while (next?.author === this.author) {
                        count++;
                        next = this.channel.messages.get(this.channel.idToNext.get(next.id));
                    }
                    span.textContent = `You have this user blocked, click to see the ${count} blocked messages.`;
                    build.append(span);
                    span.onclick = _ => {
                        const scroll = this.channel.infinite.scrollTop;
                        const func = this.channel.infinite.snapBottom();
                        let next = this;
                        while (next?.author === this.author) {
                            next.generateMessage(undefined, true);
                            next = this.channel.messages.get(this.channel.idToNext.get(next.id));
                            console.log("loopy");
                        }
                        if (this.channel.infinite.div && scroll) {
                            func();
                            this.channel.infinite.div.scrollTop = scroll;
                        }
                    };
                    div.appendChild(build);
                    return div;
                }
            }
        }
        if (this.message_reference) {
            const replyline = document.createElement("div");
            const line = document.createElement("hr");
            const minipfp = document.createElement("img");
            minipfp.classList.add("replypfp");
            replyline.appendChild(line);
            replyline.appendChild(minipfp);
            const username = document.createElement("span");
            replyline.appendChild(username);
            const reply = document.createElement("div");
            username.classList.add("username");
            reply.classList.add("replytext");
            replyline.appendChild(reply);
            const line2 = document.createElement("hr");
            replyline.appendChild(line2);
            line2.classList.add("reply");
            line.classList.add("startreply");
            replyline.classList.add("replyflex");
            this.channel.getmessage(this.message_reference.message_id).then(message => {
                if (message.author.relationshipType === 2) {
                    username.textContent = "Blocked user";
                    return;
                }
                const author = message.author;
                reply.appendChild(message.content.makeHTML({ stdsize: true }));
                minipfp.src = author.getpfpsrc();
                author.bind(minipfp);
                username.textContent = author.username;
                author.bind(username);
            });
            reply.onclick = _ => {
                this.channel.infinite.focus(this.message_reference.message_id);
            };
            div.appendChild(replyline);
        }
        div.appendChild(build);
        if ({ 0: true, 19: true }[this.type] || this.attachments.length !== 0) {
            const pfpRow = document.createElement("div");
            pfpRow.classList.add("flexltr");
            let pfpparent, current;
            if (premessage != null) {
                pfpparent ??= premessage;
                let pfpparent2 = pfpparent.all;
                pfpparent2 ??= pfpparent;
                const old = (new Date(pfpparent2.timestamp).getTime()) / 1000;
                const newt = (new Date(this.timestamp).getTime()) / 1000;
                current = (newt - old) > 600;
            }
            const combine = (premessage?.author != this.author) || (current) || this.message_reference;
            if (combine) {
                const pfp = this.author.buildpfp();
                this.author.bind(pfp, this.guild, false);
                pfpRow.appendChild(pfp);
            }
            else {
                div["pfpparent"] = pfpparent;
            }
            pfpRow.classList.add("pfprow");
            build.appendChild(pfpRow);
            const text = document.createElement("div");
            text.classList.add("flexttb");
            const texttxt = document.createElement("div");
            texttxt.classList.add("commentrow", "flexttb");
            text.appendChild(texttxt);
            if (combine) {
                const username = document.createElement("span");
                username.classList.add("username");
                this.author.bind(username, this.guild);
                div.classList.add("topMessage");
                username.textContent = this.author.username;
                const userwrap = document.createElement("div");
                userwrap.classList.add("flexltr");
                userwrap.appendChild(username);
                if (this.author.bot) {
                    const username = document.createElement("span");
                    username.classList.add("bot");
                    username.textContent = "BOT";
                    userwrap.appendChild(username);
                }
                const time = document.createElement("span");
                time.textContent = "  " + formatTime(new Date(this.timestamp));
                time.classList.add("timestamp");
                userwrap.appendChild(time);
                texttxt.appendChild(userwrap);
            }
            else {
                div.classList.remove("topMessage");
            }
            const messaged = this.content.makeHTML();
            div["txt"] = messaged;
            const messagedwrap = document.createElement("div");
            messagedwrap.classList.add("flexttb");
            messagedwrap.appendChild(messaged);
            texttxt.appendChild(messagedwrap);
            build.appendChild(text);
            if (this.attachments.length) {
                console.log(this.attachments);
                const attach = document.createElement("div");
                attach.classList.add("flexltr");
                for (const thing of this.attachments) {
                    attach.appendChild(thing.getHTML());
                }
                messagedwrap.appendChild(attach);
            }
            if (this.embeds.length) {
                console.log(this.embeds);
                const embeds = document.createElement("div");
                embeds.classList.add("flexltr");
                for (const thing of this.embeds) {
                    embeds.appendChild(thing.generateHTML());
                }
                messagedwrap.appendChild(embeds);
            }
            //
        }
        else if (this.type === 7) {
            const text = document.createElement("div");
            text.classList.add("flexttb");
            const texttxt = document.createElement("div");
            text.appendChild(texttxt);
            build.appendChild(text);
            texttxt.classList.add("flexltr");
            const messaged = document.createElement("span");
            div["txt"] = messaged;
            messaged.textContent = "welcome: ";
            texttxt.appendChild(messaged);
            const username = document.createElement("span");
            username.textContent = this.author.username;
            //this.author.profileclick(username);
            this.author.bind(username, this.guild);
            texttxt.appendChild(username);
            username.classList.add("username");
            const time = document.createElement("span");
            time.textContent = "  " + formatTime(new Date(this.timestamp));
            time.classList.add("timestamp");
            texttxt.append(time);
            div.classList.add("topMessage");
        }
        const reactions = document.createElement("div");
        reactions.classList.add("flexltr", "reactiondiv");
        this.reactdiv = new WeakRef(reactions);
        this.updateReactions();
        div.append(reactions);
        this.bindButtonEvent();
        return (div);
    }
    bindButtonEvent() {
        if (this.div) {
            let buttons;
            this.div.onmouseenter = _ => {
                if (buttons) {
                    buttons.remove();
                    buttons = undefined;
                }
                if (this.div) {
                    buttons = document.createElement("div");
                    buttons.classList.add("messageButtons", "flexltr");
                    if (this.channel.hasPermission("SEND_MESSAGES")) {
                        const container = document.createElement("div");
                        const reply = document.createElement("span");
                        reply.classList.add("svgtheme", "svg-reply", "svgicon");
                        container.append(reply);
                        buttons.append(container);
                        container.onclick = _ => {
                            this.channel.setReplying(this);
                        };
                    }
                    if (this.author === this.localuser.user) {
                        const container = document.createElement("div");
                        const edit = document.createElement("span");
                        edit.classList.add("svgtheme", "svg-edit", "svgicon");
                        container.append(edit);
                        buttons.append(container);
                        container.onclick = _ => {
                            this.setEdit();
                        };
                    }
                    if (this.canDelete()) {
                        const container = document.createElement("div");
                        const reply = document.createElement("span");
                        reply.classList.add("svgtheme", "svg-delete", "svgicon");
                        container.append(reply);
                        buttons.append(container);
                        container.onclick = _ => {
                            if (_.shiftKey) {
                                this.delete();
                                return;
                            }
                            const diaolog = new Dialog(["hdiv", ["title", "are you sure you want to delete this?"], ["button", "", "yes", () => { this.delete(); diaolog.hide(); }], ["button", "", "no", () => { diaolog.hide(); }]]);
                            diaolog.show();
                        };
                    }
                    if (buttons.childNodes.length !== 0) {
                        this.div.append(buttons);
                    }
                }
            };
            this.div.onmouseleave = _ => {
                if (buttons) {
                    buttons.remove();
                    buttons = undefined;
                }
            };
        }
    }
    updateReactions() {
        const reactdiv = this.reactdiv.deref();
        if (!reactdiv)
            return;
        const func = this.channel.infinite.snapBottom();
        reactdiv.innerHTML = "";
        for (const thing of this.reactions) {
            const reaction = document.createElement("div");
            reaction.classList.add("reaction");
            if (thing.me) {
                reaction.classList.add("meReacted");
            }
            let emoji;
            if (thing.emoji.id || /\d{17,21}/.test(thing.emoji.name)) {
                if (/\d{17,21}/.test(thing.emoji.name))
                    thing.emoji.id = thing.emoji.name; //Should stop being a thing once the server fixes this bug
                const emo = new Emoji(thing.emoji, this.guild);
                emoji = emo.getHTML(false);
            }
            else {
                emoji = document.createElement("p");
                emoji.textContent = thing.emoji.name;
            }
            const count = document.createElement("p");
            count.textContent = "" + thing.count;
            count.classList.add("reactionCount");
            reaction.append(count);
            reaction.append(emoji);
            reactdiv.append(reaction);
            reaction.onclick = _ => {
                this.reactionToggle(thing.emoji.name);
            };
        }
        func();
    }
    reactionAdd(data, member) {
        for (const thing of this.reactions) {
            if (thing.emoji.name === data.name) {
                thing.count++;
                if (member.id === this.localuser.user.id) {
                    thing.me = true;
                    this.updateReactions();
                    return;
                }
            }
        }
        this.reactions.push({
            count: 1,
            emoji: data,
            me: member.id === this.localuser.user.id
        });
        this.updateReactions();
    }
    reactionRemove(data, id) {
        console.log("test");
        for (const i in this.reactions) {
            const thing = this.reactions[i];
            console.log(thing, data);
            if (thing.emoji.name === data.name) {
                thing.count--;
                if (thing.count === 0) {
                    this.reactions.splice(Number(i), 1);
                    this.updateReactions();
                    return;
                }
                if (id === this.localuser.user.id) {
                    thing.me = false;
                    this.updateReactions();
                    return;
                }
            }
        }
    }
    reactionRemoveAll() {
        this.reactions = [];
        this.updateReactions();
    }
    reactionRemoveEmoji(emoji) {
        for (const i in this.reactions) {
            const reaction = this.reactions[i];
            if ((reaction.emoji.id && reaction.emoji.id == emoji.id) || (!reaction.emoji.id && reaction.emoji.name == emoji.name)) {
                this.reactions.splice(Number(i), 1);
                this.updateReactions();
                break;
            }
        }
    }
    buildhtml(premessage) {
        if (this.div) {
            console.error(`HTML for ${this.id} already exists, aborting`);
            return this.div;
        }
        try {
            const div = document.createElement("div");
            this.div = div;
            this.messageevents(div);
            return this.generateMessage(premessage);
        }
        catch (e) {
            console.error(e);
        }
        return this.div;
    }
}
let now;
let yesterdayStr;
updateTimes();
function formatTime(date) {
    updateTimes();
    const datestring = date.toLocaleDateString();
    const formatTime = (date) => date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
    if (datestring === now) {
        return `Today at ${formatTime(date)}`;
    }
    else if (datestring === yesterdayStr) {
        return `Yesterday at ${formatTime(date)}`;
    }
    else {
        return `${date.toLocaleDateString()} at ${formatTime(date)}`;
    }
}
const d = new Date();
let tomorrow = d.setHours(24, 0, 0, 0);
function updateTimes() {
    if (tomorrow < Date.now()) {
        tomorrow = d.setHours(24, 0, 0, 0);
        now = new Date().toLocaleDateString();
        const yesterday = new Date(now);
        yesterday.setDate(new Date().getDate() - 1);
        yesterdayStr = yesterday.toLocaleDateString();
    }
}
Message.setup();
export { Message };
