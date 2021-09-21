import chalk from "chalk";
import io, { Socket } from "socket.io-client";
// @ts-ignore
import * as fetch from "node-fetch";
import EventEmitter from "eventemitter3";
export const PORT = process.env.PORT || 8081;

export interface IMessage {
  _id: string;
  created_at: number;
  content?: string;
  attachments?: string[];
  channel_id: string;
  author_id: string;
}

export interface ICommand {
  name: string | undefined;
  args: Array<string>;
}

export interface User {
  email: string;
  password: string;
  _id: string;
  created_at: number;
  username: string;
  profileImage?: string;
  profileBanner?: string;
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

/**
 * Main Taku Class
 * @author cimok
 */
class TAKUBOT extends EventEmitter {
  protected backendURL: string = "backend.taku.moe";
  protected token: string | undefined;
  protected socket: Socket;
  protected version: string = "v1";
  protected verbose: Boolean;
  protected prefix: string;
  protected logger;

  constructor(token: string | undefined, verbose: Boolean, prefix: string) {
    super();
    this.logger = new Logger(verbose);
    this.verbose = verbose;
    this.prefix = prefix;
    this.socket = io(`ws://${this.backendURL}`, {
      auth: { token },
      transports: ["websocket"],
    });
    this.socket.on("connect", () => {
      this.logger.socket("Connected", this.backendURL);
      this.emit("connection");
    });
    this.socket.on("reconnect_attempt", () => {
      console.log("Reconnecting attempt");
      this.logger.socket("Reconnected", this.backendURL);
    });
    this.socket.on("globalMessage", async (message: IMessage) => {
      const { name, args } = this.parseCommand(message);
      this.emit("message", message);
      message.content?.startsWith(this.prefix) &&
        this.emit("command", { ...message, name, args } as IParsedMessage);
      // this.gotMessage(message, "globalMessage");
    });
  }

  /**
   * @author Geoxor
   * @param method get | post etc
   * @param endpoint user etc
   * @param body optional
   * @returns json
   */
  private async request<T>(method: string, endpoint: string, body?: object): Promise<T> {
    const url = `http://${this.backendURL}/${this.version}${endpoint}`;

    const headers = {
      "Content-Type": "application/json",
      Authorization: this.token || "unset",
    };

    const options = {
      method: method.toUpperCase(),
      headers,
      body: JSON.stringify(body),
    };

    this.logger.request(method, `/${this.version}${endpoint}`);

    const response = await fetch(url, options);
    const data = await response.json();

    return data;
  }

  /**
   * Gets the users profile information
   * @author cimok
   * @param userId users uuid
   * @returns json of the users profile
   */
  public async getUser(userId: string) {
    try {
      const { user } = await this.request<{ user: User }>("get", `/user/${userId}`);
      return user;
    } catch {
      return;
    }
  }

  /**
   * Send a message to the chat.
   * @author cimok
   * @param channel the websocket channel ID (globalMessage)
   * @param message the message to be sent to the chat
   */
  public send(message: string) {
    this.socket.emit("globalMessage", message);
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

export default TAKUBOT;
