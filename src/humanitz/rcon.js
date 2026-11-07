import net from "node:net";

const PACKET_TYPES = {
  Auth: 3,
  AuthResponse: 2,
  Command: 2,
  Response: 0
};

function encodePacket(id, type, body) {
  const content = Buffer.from(body, "utf8");
  const size = 4 + 4 + content.length + 2;
  const packet = Buffer.alloc(size + 4);
  packet.writeInt32LE(size, 0);
  packet.writeInt32LE(id, 4);
  packet.writeInt32LE(type, 8);
  content.copy(packet, 12);
  return packet;
}

function readPackets(buffer) {
  const packets = [];
  let offset = 0;

  while (buffer.length - offset >= 4) {
    const size = buffer.readInt32LE(offset);
    if (size < 10 || size > 1024 * 1024) {
      throw new Error("Paquet RCON invalide recu du serveur.");
    }

    const packetLength = size + 4;
    if (buffer.length - offset < packetLength) break;

    const id = buffer.readInt32LE(offset + 4);
    const type = buffer.readInt32LE(offset + 8);
    const bodyEnd = offset + packetLength - 2;
    const body = buffer.toString("utf8", offset + 12, bodyEnd);
    packets.push({ id, type, body });
    offset += packetLength;
  }

  return { packets, remaining: buffer.subarray(offset) };
}

export class HumanitZRcon {
  constructor({ host, port, password, timeoutMs = 8_000 }) {
    if (!host || !port || !password) {
      throw new Error("Configuration RCON HumanitZ incomplete.");
    }

    this.host = host;
    this.port = port;
    this.password = password;
    this.timeoutMs = timeoutMs;
    this.socket = null;
    this.buffer = Buffer.alloc(0);
    this.nextId = 1;
    this.waiters = new Map();
    this.commandChain = Promise.resolve();
  }

  async connect() {
    if (this.socket) return;

    this.socket = net.createConnection({ host: this.host, port: this.port });
    this.socket.setNoDelay(true);
    this.socket.on("data", (chunk) => this.handleData(chunk));
    this.socket.on("error", (error) => this.failAll(error));
    this.socket.on("close", () => this.failAll(new Error("Connexion RCON fermee.")));

    await new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error("Connexion RCON expiree.")), this.timeoutMs);
      this.socket.once("connect", () => {
        clearTimeout(timer);
        resolve();
      });
      this.socket.once("error", (error) => {
        clearTimeout(timer);
        reject(error);
      });
    });

    const id = this.getId();
    const reply = this.waitFor(id, PACKET_TYPES.AuthResponse);
    this.socket.write(encodePacket(id, PACKET_TYPES.Auth, this.password));
    const packet = await reply;

    if (packet.id === -1) {
      throw new Error("Mot de passe RCON refuse.");
    }
  }

  async command(command) {
    const task = this.commandChain.then(() => this.sendCommand(command));
    this.commandChain = task.catch(() => undefined);
    return task;
  }

  async sendCommand(command) {
    if (!this.socket) await this.connect();

    const id = this.getId();
    const reply = this.waitFor(id, PACKET_TYPES.Response);
    this.socket.write(encodePacket(id, PACKET_TYPES.Command, command));
    return (await reply).body.trim();
  }

  disconnect() {
    this.socket?.destroy();
    this.socket = null;
  }

  getId() {
    const id = this.nextId;
    this.nextId += 1;
    return id;
  }

  waitFor(id, type) {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.waiters.delete(id);
        reject(new Error("Reponse RCON expiree."));
      }, this.timeoutMs);

      this.waiters.set(id, {
        type,
        resolve: (packet) => {
          clearTimeout(timer);
          resolve(packet);
        },
        reject: (error) => {
          clearTimeout(timer);
          reject(error);
        }
      });
    });
  }

  handleData(chunk) {
    this.buffer = Buffer.concat([this.buffer, chunk]);
    const { packets, remaining } = readPackets(this.buffer);
    this.buffer = remaining;

    for (const packet of packets) {
      if (process.env.HUMANITZ_RCON_DEBUG === "1") {
        console.log(`Paquet RCON recu: id=${packet.id}, type=${packet.type}, taille=${packet.body.length}`);
      }

      const entries = [...this.waiters.entries()];
      const authFailure = packet.id === -1 && packet.type === PACKET_TYPES.AuthResponse;
      const fallbackResponse = packet.type === PACKET_TYPES.Response && !this.waiters.has(packet.id);
      const waiterEntry = authFailure
        ? entries.find(([, candidate]) => candidate.type === PACKET_TYPES.AuthResponse)
        : fallbackResponse
          ? entries.find(([, candidate]) => candidate.type === PACKET_TYPES.Response)
          : [packet.id, this.waiters.get(packet.id)];
      const [waiterId, waiter] = waiterEntry ?? [];
      if (!waiter || waiter.type !== packet.type) continue;

      this.waiters.delete(waiterId);
      waiter.resolve(packet);
    }
  }

  failAll(error) {
    for (const [id, waiter] of this.waiters) {
      this.waiters.delete(id);
      waiter.reject(error);
    }
  }
}
