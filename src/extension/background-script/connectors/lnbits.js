import sha256 from "crypto-js/sha256";
import Hex from "crypto-js/enc-hex";
import { parsePaymentRequest } from "invoices";
import Base from "./base";
import utils from "../../../common/lib/utils";

const EC = require("elliptic").ec;
const ec = new EC("secp256k1");

class LnBits extends Base {
  getInfo() {
    console.log(this.config);
    return this.request(
      "GET",
      "/api/v1/wallet",
      this.config.adminkey,
      undefined,
      {}
    ).then((data) => {
      return {
        data: {
          alias: data.name,
        },
      };
    });
  }

  getBalance() {
    return this.request(
      "GET",
      "/api/v1/wallet",
      this.config.adminkey,
      undefined,
      {}
    ).then((data) => {
      // TODO better amount handling
      const balanceInSats = data.balance / 1000;
      return {
        data: {
          balance: balanceInSats,
        },
      };
    });
  }

  sendPayment(args) {
    const paymentRequestDetails = parsePaymentRequest({
      request: args.paymentRequest,
    });
    const amountInSats = parseInt(paymentRequestDetails.tokens);
    return this.request("POST", "/api/v1/payments", this.config.adminkey, {
      bolt11: args.paymentRequest,
      out: true,
    })
      .then((data) => {
        // TODO: how do we get the total amount here??
        return this.checkPayment(data.payment_hash).then((checkData) => {
          return {
            data: {
              preimage: checkData.preimage,
              paymentHash: data.payment_hash,
              route: { total_amt: amountInSats, total_fees: 0 },
            },
          };
        });
      })
      .catch((e) => {
        return { error: e.message };
      });
  }

  checkPayment(paymentHash) {
    return this.request(
      "GET",
      `/api/v1/payments/${paymentHash}`,
      this.config.adminkey
    );
  }

  signMessage(args) {
    // make sure we got the config to create a new key
    if (!this.config.url || !this.config.adminkey) {
      return Promise.reject(new Error("Missing config"));
    }
    // create a signing key from the lnbits URL and the adminkey
    const key = sha256(
      `LBE-LNBITS-${this.config.url}-${this.config.adminkey}`
    ).toString(Hex);
    if (!key) {
      return Promise.reject(new Error("Could not create key"));
    }
    const sk = ec.keyFromPrivate(key);
    // const pk = sk.getPublic();
    // const pkHex = pk.encodeCompressed("hex"); //pk.encode('hex')

    const messageHex = utils.hexToUint8Array(args.message);

    const signedMessage = sk.sign(messageHex);
    const signedMessageDERHex = signedMessage.toDER("hex");

    // make sure we got some signed message
    if (!signedMessageDERHex) {
      return Promise.reject(new Error("Signing failed"));
    }
    return Promise.resolve({
      data: {
        signature: signedMessageDERHex,
      },
    });
  }

  verifyMessage(args) {
    return Promise.reject(new Error("Not supported with Lnbits"));
  }

  makeInvoice(args) {
    return this.request("POST", "/api/v1/payments", this.config.adminkey, {
      amount: args.amount,
      memo: args.memo,
      out: false,
    }).then((data) => {
      return {
        data: {
          paymentRequest: data.payment_request,
          rHash: data.payment_hash,
        },
      };
    });
  }

  async request(method, path, apiKey, args, defaultValues) {
    let body = null;
    let query = "";
    const headers = new Headers();
    headers.append("Accept", "application/json");
    headers.append("Content-Type", "application/json");
    headers.append("X-Api-Key", apiKey);

    if (method === "POST") {
      body = JSON.stringify(args);
    } else if (args !== undefined) {
      query = `?`; //`?${stringify(args)}`;
    }
    const res = await fetch(this.config.url + path + query, {
      method,
      headers,
      body,
    });
    if (!res.ok) {
      const errBody = await res.json();
      console.log("errBody", errBody);
      throw new Error(errBody.message);
    }
    let data = await res.json();
    if (defaultValues) {
      data = Object.assign(Object.assign({}, defaultValues), data);
    }
    return data;
  }
}

export default LnBits;
