import chalk from "chalk";
import io, { Socket } from "socket.io-client";
// @ts-ignore
import * as fetch from "node-fetch";
import EventEmitter from "eventemitter3";
import FormData from "form-data";
export const PORT = process.env.PORT || 8081;

export interface IMessage {
  _id: string;
  created_at: number;
  content?: string;
  attachments?: string[];
  channel_id: string;
  author_id: string;
  replying_to?: string;
}

export interface ICommand {
  name: string | undefined;
  args: Array<string>;
}

export interface User {
  _id: string;
  created_at: number;
  username: string;
  email: string;
  password: string;
  last_seen: number;
  status: string;
  device: string;
  avatar?: string;
  banner?: string;
  saved_emojis: [string];
  guild_list: [string];
}

export type IParsedMessage = IMessage & ICommand;

/**
 * Logger Class
 * @author cimok
 */
class Logger {
  protected verbose;
  constructor(verbose: Boolean) {
    this.verbose = verbose;
  }

  socket(type: string, url: string) {
    if (this.verbose) {
      console.log(`${chalk.green("[SOCKET]")} ${url}: ${type}`);
    }
  }

  log(log: string) {
    if (this.verbose) {
      console.log(`${chalk.blue("[LOG]")} ${log}`);
    }
  }

  message(message: string) {
    if (this.verbose) {
      console.log(`${chalk.blue("[MESSAGE]")} ${message}`);
    }
  }

  request(method: string, url: string) {
    if (this.verbose) {
      console.log(`${chalk.red("[REQUEST]")} ${chalk.cyan(method.toUpperCase())} ${url}`);
    }
  }
}



interface IField {
  name: string;
  content: string;
}

export interface BackendGuildDatabaseEntry {
  _id: string;
  owner_id: string;
  name: string;
  hostname: string;
}

export type HexString = `#${string}`;

interface IMessageEmbed {
  title?: string;
  description?: string;
  fields?: IField[];
  image?: string;
  color?: HexString;
}

export class MessageEmbed implements IMessageEmbed {
  public title?: string;
  public description?: string;
  public fields?: IField[];
  public image?: string;
  public color?: HexString;

  public constructor(data: IMessageEmbed) {
    this.title = data.title;
    this.description = data.description;
    this.fields = data.fields;
    this.image = data.image;
    this.color = data.color;
  }

  public static toJSON(data: MessageEmbed) {
    return JSON.stringify(data);
  }
}

/**
 * Client Class
 * @author cimok
 */
export class Client extends EventEmitter {
  protected backendURL: string = "backend.taku.moe";
  protected guildURL: string = "taku.cimok.co.uk";
  protected token: string | undefined;
  protected uuid: string;
  protected socket: Socket;
  protected version: string = "v1";
  protected verbose: Boolean;
  protected prefix: string;
  protected logger;
  protected sockets: Map<string, Socket> = new Map;

  constructor(token: string | undefined, uuid: string, verbose: Boolean, prefix: string) {
    super();
    this.logger = new Logger(verbose);
    this.verbose = verbose;
    this.prefix = prefix;
    this.token = token;
    this.uuid = uuid;
    this.connectToGuilds();
    this.socket = io(`wss://${this.backendURL}`, {
      auth: {
        uuid: this.uuid,
        token,
        device: "terminal",
      },
      transports: ["websocket"],
    });
    
  }

  /**
   * Makes an HTTP request to the backend
   * @param method The HTTP verb to cast
   * @param endpoint The backend endpoint route
   * @param body The body to send
   * @author Geoxor
   */
  private async request<T>(method: string, url: string, body?: object): Promise<T> {
    // Very stupid, good job fetch API
    if (body instanceof FormData) {
      var headers = {
        Authorization: this.token || "unset",
      };
    } else {
      // @ts-ignore
      var headers = {
        "Content-Type": body instanceof FormData ? undefined : "application/json",
        Authorization: this.token || "unset",
      };
    }

    const options = {
      method: method.toUpperCase(),
      headers,
      body: body instanceof FormData ? body : JSON.stringify(body),
    };

    const response = await fetch(url, options);
    const data = await response.json();

    return data;
  }

  private async backendRequest<T>(method: string, endpoint: string, body?: object): Promise<T> {
    const url = `https://${this.backendURL}/v1${endpoint}`;
    return this.request(method, url, body);
  }

  private async connectToGuilds() {
    const guilds = await this.getGuilds();
    if (!guilds) return;
    for (let i = 0; i < guilds.length; i++) {
      const guild = await this.getGuild(guilds[i]);
      try {
        this.sockets.set(guild._id, await this.connectToGuildSocket(guild.hostname));
      } catch (err) {
        console.log("Cannot connect");
      }
    }
    this.addListeners();
  }

  private addListeners() {
    const sockets = Array.from(this.sockets.values());
    const guildIDs = Array.from(this.sockets.keys());
    for (let i = 0; i < sockets.length; i++) {
      const guildId = guildIDs[i];
      const socket = sockets[i];
      socket.on("connect", () => {
        this.logger.socket("Connected", socket.io.socket.name);
        this.emit("connection", guildId);
      });
      socket.on("disconnect", () => {
        this.logger.socket("Disconnected", socket.io.socket.name);
        this.emit("disconnection", guildId);
      });
      socket.on("reconnect_attempt", () => {
        this.logger.socket("Reconnecting attempt", socket.io.socket.name);
        this.emit("reconnecting", guildId);
      });
      socket.on("message", (message) => {
        this.emit("message", {guildId, ...message})
      });
    }
  }

  /**
   * Gets a guild's data from the backend (minimal)
   * @param uuid the guild id to get
   * @returns
   */
  public async getGuild(uuid: string) {
    return this.backendRequest<BackendGuildDatabaseEntry>("get", `/guild/${uuid}`).catch();
  }

  /**
   * @author cimok
   * Gets the uuids of the guilds that the account is currently in
   * @returns array of guild uuids
   */
  public async getGuilds() {
    const user = await this.getUser(this.uuid);
    if (!user) return;
    return user.guild_list;
  }

  private async connectToGuildSocket(hostname: string) {
    const { token } = await this.request<{ guild_id: string; token: string }>("post", `${hostname}/login`, {
      uuid: this.uuid,
    });

    return io(hostname.replace("https://", "wss://").replace("http://", "ws://"), {
      auth: {
        uuid: this.uuid,
        token,
      },
      transports: ["websocket"],
    });
  }

  /**
   * Gets the users profile information
   * @author cimok
   * @param userId users uuid
   * @returns json of the users profile
   */
  public async getUser(userId: string) {
    if (userId.startsWith("https://taku.moe/user/")) userId = userId.replace("https://taku.moe/user/", "");
    try {
      const { user } = await this.backendRequest<{ user: User }>("get", `/user/${userId}`);
      return user;
    } catch (err) {
      console.log(err);
      return;
    }
  }

  /**
   * Gets all users currently on Taku
   * @returns array of user objects
   */
  public async getUsers() {
    try {
      return await this.backendRequest<User[]>("get", "/users");
    } catch (err) {
      console.log(err);
      return;
    }
  }

  /**
   * Send a message to the chat.
   * @author cimok
   * @param channel the websocket channel ID (globalMessage)
   * @param message the message to be sent to the chat
   */
  public send(message: string, messageId?: string | undefined) {
    this.socket.emit("globalMessage", {
      content: message,
      replyingTo: messageId,
    });
  }

  /**
   * Parses the array from message into a command and args.
   * @author cimok
   * @param message The message to parse
   * @returns the command and args
   */
  public parseCommand(message: IMessage): ICommand {
    let args = message.content?.replace(this.prefix, "").split(" ");
    args ??= [];
    return { name: args.shift(), args };
  }
}
