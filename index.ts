import { Client, StageChannel, User } from 'discord.js';
import { readFileSync, appendFileSync, writeFileSync } from 'fs';
import { RateLimiter } from 'limiter';

const AMA_CHANNEL_ID = "808605618285445120"// "827196357290229801"

let client: Client;

const tokens = readFileSync("token.txt", {encoding: "utf-8"}).split("\n");
const message = readFileSync("message.txt", {encoding: "utf-8"});
const poaps = readFileSync("poaps.txt", {encoding: "utf-8"}).split("\n");

const delay = 5; // in seconds
const requiredLogs = 2;

const limiter = new RateLimiter({ tokensPerInterval: 20, interval: 60000 });

let changingAccounts = false;

main()

async function main() {
    await logIn();
    writeFileSync("failed.txt", "");

    const users: {[user: string]: number} = {};

    while(true) {
        changingAccounts = false;

        (await collectUsers()).forEach(user => {
            users[user.id] = users[user.id] ? users[user.id] + 1 : 1;
            if(users[user.id] === requiredLogs) sendMessage(user.id);
        })

        await sleep(delay * 1000);
    }
}

async function logIn() {
    const token = tokens.shift()

    if(!token) return false

    try {
        changingAccounts = true
        client = new Client({ intents: ['DIRECT_MESSAGES', 'GUILDS', 'GUILD_VOICE_STATES', 'GUILD_WEBHOOKS', 'GUILD_MEMBERS']});
        await client.login(token)
        changingAccounts = false
        return true
    }
    catch(err) {
        console.log(err)
        changingAccounts = false
        return false
    }
}

async function collectUsers() {
    const stage = await client.channels.fetch(AMA_CHANNEL_ID, false) as StageChannel;

    return stage.members.map(a => a.user);
}

async function sendMessage(userId: any) {
    const user = await client.users.fetch(userId, false)
    await limiter.removeTokens(1);
    const poap = getPoap();

    if(poap) {
        try {
            await user.send(poap + "\n\n" + message);
        }
        catch(err) {
            reAddPoap(poap);
            if(err.code === 20026) {
                if(!changingAccounts) console.log(`Bot ${user.client.token} banned!`);
                if(!changingAccounts && !await logIn()) {
                    console.log("Failed to send message to: " + user.username);
                    appendFileSync("failed.txt", user.id + "\n");
                    console.log("All bots banned!");
                    return;
                }
                await waitForAccountChange();
                await sendMessage(userId);
            }
            else {
                console.log("Failed to send message to: " + user.username);
                appendFileSync("failed.txt", user.id + "\n");
            }
        }
    }
    else {
        console.log("Out of POAPs");
        appendFileSync("failed.txt", user.id + "\n");
    }
}

function sleep(ms: number) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

function getPoap() {
    return poaps.shift()
}

function reAddPoap(poap: string) {
    poaps.push(poap)
}

async function waitForAccountChange() {
    return new Promise((resolve) => {
        const check = () => {
            if(!changingAccounts) { 
                resolve(true)
            }
        }
        setInterval(check, 100)
    })
}