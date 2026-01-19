const assert = require("assert");
const { describe, it } = require("node:test");
const { logRequest } = require("../../src/middleware/logger");

describe("Logger Middleware", () => {
  describe("logRequest", () => {
    it("should log the request method and URL", () => {
      const logs = [];
      const originalLog = console.log;
      console.log = (...args) => logs.push(args);

      const req = { method: "GET", url: "/test" };
      const res = {};
      let nextCalled = false;
      const next = () => { nextCalled = true; };

      logRequest(req, res, next);

      console.log = originalLog;

      assert.strictEqual(logs.length, 1);
      assert.deepStrictEqual(logs[0], [">", "GET", "/test"]);
      assert.ok(nextCalled);
    });

    it("should call next()", () => {
      const originalLog = console.log;
      console.log = () => {};

      const req = { method: "POST", url: "/api/data" };
      const res = {};
      let nextCalled = false;
      const next = () => { nextCalled = true; };

      logRequest(req, res, next);

      console.log = originalLog;

      assert.ok(nextCalled);
    });

    it("should log different HTTP methods", () => {
      const logs = [];
      const originalLog = console.log;
      console.log = (...args) => logs.push(args);

      const methods = ["GET", "POST", "PUT", "DELETE", "PATCH"];
      
      methods.forEach(method => {
        const req = { method, url: "/endpoint" };
        logRequest(req, {}, () => {});
      });

      console.log = originalLog;

      assert.strictEqual(logs.length, 5);
      methods.forEach((method, i) => {
        assert.strictEqual(logs[i][1], method);
      });
    });

    it("should log URLs with query parameters", () => {
      const logs = [];
      const originalLog = console.log;
      console.log = (...args) => logs.push(args);

      const req = { method: "GET", url: "/search?q=test&page=1" };
      logRequest(req, {}, () => {});

      console.log = originalLog;

      assert.deepStrictEqual(logs[0], [">", "GET", "/search?q=test&page=1"]);
    });
  });
});
