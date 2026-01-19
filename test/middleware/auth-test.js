const assert = require("assert");
const { describe, it } = require("node:test");
const { authorize } = require("../../src/middleware/auth");

describe("Auth Middleware", () => {
  describe("authorize", () => {
    it("should call next() when username cookie exists", () => {
      const req = {
        cookies: { username: "testUser" },
      };
      const res = {};
      let nextCalled = false;
      const next = () => { nextCalled = true; };

      authorize(req, res, next);

      assert.ok(nextCalled);
    });

    it("should redirect to / when username cookie is missing", () => {
      const req = {
        cookies: {},
      };
      let redirectedTo = null;
      const res = {
        redirect: (url) => { redirectedTo = url; },
      };
      let nextCalled = false;
      const next = () => { nextCalled = true; };

      authorize(req, res, next);

      assert.strictEqual(redirectedTo, "/");
      assert.ok(!nextCalled);
    });

    it("should redirect to / when cookies object is empty", () => {
      const req = {
        cookies: {},
      };
      let redirectedTo = null;
      const res = {
        redirect: (url) => { redirectedTo = url; },
      };
      let nextCalled = false;
      const next = () => { nextCalled = true; };

      authorize(req, res, next);

      assert.strictEqual(redirectedTo, "/");
      assert.ok(!nextCalled);
    });

    it("should redirect to / when username is empty string", () => {
      const req = {
        cookies: { username: "" },
      };
      let redirectedTo = null;
      const res = {
        redirect: (url) => { redirectedTo = url; },
      };
      let nextCalled = false;
      const next = () => { nextCalled = true; };

      authorize(req, res, next);

      assert.strictEqual(redirectedTo, "/");
      assert.ok(!nextCalled);
    });

    it("should not call next() after redirecting", () => {
      const req = {
        cookies: {},
      };
      let redirectedTo = null;
      const res = {
        redirect: (url) => { redirectedTo = url; },
      };
      let nextCalled = false;
      const next = () => { nextCalled = true; };

      authorize(req, res, next);

      assert.ok(redirectedTo);
      assert.ok(!nextCalled);
    });

    it("should allow any non-empty username", () => {
      const usernames = ["a", "player123", "John Doe", "user@email.com"];
      
      usernames.forEach(username => {
        const req = { cookies: { username } };
        let nextCalled = false;
        const next = () => { nextCalled = true; };

        authorize(req, {}, next);

        assert.ok(nextCalled, `Should allow username: ${username}`);
      });
    });
  });
});
