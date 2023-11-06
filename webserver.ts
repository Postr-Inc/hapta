import Hapta from ".";
import gateway from "./auth/.";
import Pocketbase from "pocketbase";
const balancer = new Hapta({
  maxRoomSize: 10,
  maxConnections: 1000,
  should_log: true,
  timeout: 10000,
  pocketbase: new Pocketbase(`https://postrapi.pockethost.io`),
});

function authorize(token) {
  return balancer.authorize(token).status;
}
function handleRequests(data) {
  switch (data.type) {
    case "connect":
      if (!data.token) {
        return JSON.stringify({
          status: 403,
          message: "Unauthorized",
        });
      }
      return balancer.connect(data.token);

    case "request":
      if (!data.requestBody) {
        return JSON.stringify({
          status: 403,
          message: "Missing requestBody",
        });
      }
      if (!data.requestBody.token) {
        return JSON.stringify({
          status: 403,
          message: "Missing token",
        });
      }
      if (!authorize(data.requestBody.token)) {
        return JSON.stringify({
          status: 403,
          message: "Unauthorized",
        });
      }
      return balancer.request(data.requestBody);
      break;
    default:
      return JSON.stringify({
        status: 403,
        message: "Invalid request type",
      });
      break;
  }
}
let server = Bun.serve({
  port: 8080,
  fetch(req) {
    const success = server.upgrade(req);
    if (success) {
      // Bun automatically returns a 101 Switching Protocols
      // if the upgrade succeeds
      return undefined;
    }
    return new Response(
      JSON.stringify({ status: 200, body: "Hapta is running" }, 2),
    );
  },
  websocket: {
    async message(ws, d) {
      d = d.toString();
      d = JSON.parse(d);

      switch (d.type) {
        case "connect":
          if (!d.token) {
            ws.send(
              JSON.stringify({
                status: 403,
                message: "Unauthorized",
              }),
            );
            return;
          }
          ws.send(handleRequests(d));
          break;
        case "authorize":
          if (!d.payload.userId) {
            ws.send(
              JSON.stringify({
                status: 403,
                message: "Missing userId for authorization signature",
              }),
            );
            return;
          }
          ws.send(
            JSON.stringify({
              status: 200,
              message: "Success",
              token: new gateway().sign(d.payload.userId),
            }),
          );
          break;

        case "request":
          if (!d.requestBody) {
            ws.send(
              JSON.stringify({
                status: 403,
                message: "Missing requestBody",
              }),
            );
            return;
          }

          ws.send(await handleRequests(d));
          break;
      }
    },
  },
});
console.log("Hapta Webserver started");

let ws = new WebSocket("ws://localhost:8080");
ws.onmessage = async (e) => {
  let data = e.data.toString();

  data = JSON.parse(data);
  if (data.status == 200) {
    console.log("Authorized");
    ws.send(
      JSON.stringify({
        type: "connect",
        token: data.token,
      }),
    );
  }

  if (data.status == 403) {
    console.log("Unauthorized");
  }
  if (data.clientData) {
    console.log("Client data: ", data.clientData);
    let count = 0;
    setInterval(() => {
      if (count > 10) {
        return;
      }
      count++;
      ws.send(
        JSON.stringify({
          type: "request",
          requestBody: {
            token: data.clientData.token,
            body: {
              collection: "users",
              type: "getList",
              page: 0,
              count: 10,
              expand: ["followers"],
            },
          },
        }),
      );
    }, 1000);
  }
  console.log(data);
};

ws.onopen = () => {
  console.log("Connected");
  ws.send(
    JSON.stringify({
      type: "authorize",
      payload: {
        userId: Math.random().toString(36).substring(7),
      },
    }),
  );
};
