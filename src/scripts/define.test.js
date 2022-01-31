const {
  axios,
  getApp,
  utils: { cache },
} = require("../utils/test");
const script = require("./define");

const glossaryData = {
  "ADR": {
      "type": "acronym",
      "term": "Alternative dispute resolution"
  },
  "Alternative dispute resolution": {
      "type": "term",
      "description": "ADR includes dispute resolution processes and techniques that fall outside of the government judicial process."
  },
  "POP": {
      "type": "acronym",
      "term": [
          "Procurement Operating Procedure",
          "Period of Performance"
      ]
  },
  "Procurement Operating Procedure": {
      "type": "term",
      "description": "The procedure for procuring a procurement"
  },
  "Period of Performance": {
      "type": "term",
      "description": null
  },
  "T&M": {
      "type": "acronym",
      "term": "Time & materials"
  },
  "Time & materials": {
      "type": "term",
      "description": "A contractual arrangement whereby payment is made on the basis of time and materials."
  }
}

function buildSearchMessage(searchTerm) {
  return {
    context: {
      matches: [`@Charlie define ${searchTerm}`, "define", searchTerm],
    },
    event: { thread_ts: "thread timestamp" },
    say: jest.fn(),
  };
}

function expectedResponse(expectedText) {
  return {
    icon_emoji: ":book:",
    thread_ts: "thread timestamp",
    text: expectedText,
  };
};

describe("glossary", () => {
  const app = getApp();

  beforeEach(() => {
    jest.resetAllMocks();
    cache.mockResolvedValue(glossaryData);
  });

  it("registers a handler", () => {
    script(app);
    expect(app.message).toHaveBeenCalledWith(
      expect.any(Function),
      /(define|glossary) (.+)/i,
      expect.any(Function)
    );
  });

  describe("lookup", () => {
    let handler;

    beforeEach(() => {
      script(app);
      handler = app.getHandler();
    });

    describe("without finding an entry", () => {
      const message = buildSearchMessage("a term with no match");

      it("displays the 'no match' response", async () => {
        await handler(message);
        expect(message.say).toHaveBeenCalledWith(
          expectedResponse("I couldn't find *a term with no match*. Once you find out what it means, would you please <https://github.com/18F/the-glossary/issues/new?title=New%20entry|add it to the glossary>?")
        );
      });
    })

    describe("finding an entry", () => {
      describe("of type 'term'", () => {
        describe("without a description", () => {
          const message = buildSearchMessage("Period of Performance");

          it("displays the 'no definition' message", async () => {
            await handler(message);
            expect(message.say).toHaveBeenCalledWith(
              expectedResponse("The term *Period of Performance* is in the glossary, but does not have a definition. If you find out what it means, <https://github.com/18F/the-glossary/issues/new?title=Definition for Period of Performance|please add it>!")
            );
          });
        });
        describe("with a description", () => {
          const message = buildSearchMessage("Alternative dispute resolution");

          it("displays the provided definition", async () => {
            await handler(message);

            expect(message.say).toHaveBeenCalledWith(
              expectedResponse("*Alternative dispute resolution*: ADR includes dispute resolution processes and techniques that fall outside of the government judicial process.")
            );
          });
        });

        describe("using characters encoded as HTML entities", () => {
          const message = buildSearchMessage("time &amp; materials");

          it("renders correctly", async () => {
            await handler(message);
            expect(message.say).toHaveBeenCalledWith(
              expectedResponse("*Time & materials*: A contractual arrangement whereby payment is made on the basis of time and materials.")
            );
          });
        });
      });

      describe("of type 'acronym'", () => {
        describe("without finding an entry", () => {
          const message = buildSearchMessage("LOL");

          it("displays the 'no match' response", async () => {
            await handler(message);
            expect(message.say).toHaveBeenCalledWith(
              expectedResponse("I couldn't find *LOL*. Once you find out what it means, would you please <https://github.com/18F/the-glossary/issues/new?title=New%20entry|add it to the glossary>?")
            );
          });
        });
        describe("finding an entry", () => {
          describe("with one term", () => {
            const message = buildSearchMessage("T&M");

            it("displays the acronym and the term", async () => {
              await handler(message);
              expect(message.say).toHaveBeenCalledWith(
                expectedResponse("**T&M** means:\n*Time & materials*: A contractual arrangement whereby payment is made on the basis of time and materials.")
              );
            });
          });
          describe("with multiple terms", () => {
            const message = buildSearchMessage("POP");
            it("displays the acronym and all linked terms", async () => {
              await handler(message);
              expect(message.say).toHaveBeenCalledWith(
                expectedResponse(
                    "**POP** means:"
                  + "\n*Procurement Operating Procedure*: The procedure for procuring a procurement"
                  + "\nThe term *Period of Performance* is in the glossary, but does not have a definition. If you find out what it means, <https://github.com/18F/the-glossary/issues/new?title=Definition for Period of Performance|please add it>!"
                )
              );
            });
          });
        });
      });

    });

    it("fetches and parses YAML", async () => {
      cache.mockResolvedValue({});
      const message = buildSearchMessage("");
      await handler(message);

      const fetcher = cache.mock.calls[0].pop();

      axios.get.mockResolvedValue({
        data: `
abbreviations:
  term 1: alice
  term 2:
    bob: debra
`,
      });

      const result = await fetcher();

      expect(result).toEqual({ "term 1": "alice", "term 2": { bob: "debra" } });
    });
  });
});
