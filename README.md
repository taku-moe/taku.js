# Taku Bot API

<div align="center">
  <br />
  <p>
    <a href="https://taku.moe"><img src="https://cdn.discordapp.com/attachments/733320427648319623/889270356261621810/logo.png" width="240" alt="taku.moe" /></a>
  </p>
</div>

## About

Taku Bot API is the Official API for creating Taku.moe bots.

## Installation

`npm install taku.js`

Example Bot:

```ts
import Taku from 'taku.js';
const Taku = new TAKU(process.env.BOT_TOKEN, true, "!");

Taku.on("message", async (message: IMessage) => {
  // {...} do something with message
})

Taku.on("command", async (command: IParsedMessage) => {
  // {...} do something with command
})
```

Example Whois Command:

```ts
import Taku from 'taku.js';
const Taku = new TAKU(process.env.BOT_TOKEN, true, "!");

Taku.on("command", async (command: IParsedMessage) => {
  if (command.author_id == "9af3e207-f075-469d-8f2d-f1821c27e3cb") return;
  if (command.name == "whois") {
    const user = await Taku.getUser(command.args[0]);
    if (!user) return Taku.send("Not Found");
    // {...] do something with user
  }
})
```

Example Message Embed:

```ts
const embed = MessageEmbed.toJSON(new MessageEmbed({
  title: "Message Embed",
  description: "This is a Message Embed",
  image: "https://cdn.discordapp.com/avatars/165087303281147904/a_7dcd0f0c6ca3bced355b43338b795987.gif",
  fields: [
    {name: "Email", content: "cimok@taku.moe"},
    {name: "Created", content: "1631893014502"}
  ]
}))
```

### Todo

- [x] Add EventEmitters
- [ ] Add better documentation
- [ ] Add Bot gathering information (get information on the bot)
- [ ] Add Custom Embeds (MessageEmbed etc)
