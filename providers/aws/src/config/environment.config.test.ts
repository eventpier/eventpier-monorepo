import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  InvalidEnvironmentConfigError,
  resolveEnvironmentConfig,
} from "./environment.config.js";

describe("resolveEnvironmentConfig", () => {
  const originalEndpoint = process.env.MINISTACK_ENDPOINT;
  const originalManaged = process.env.MINISTACK_MANAGED;

  beforeEach(() => {
    delete process.env.MINISTACK_ENDPOINT;
    delete process.env.MINISTACK_MANAGED;
  });

  afterEach(() => {
    if (originalEndpoint === undefined) {
      delete process.env.MINISTACK_ENDPOINT;
    } else {
      process.env.MINISTACK_ENDPOINT = originalEndpoint;
    }
    if (originalManaged === undefined) {
      delete process.env.MINISTACK_MANAGED;
    } else {
      process.env.MINISTACK_MANAGED = originalManaged;
    }
  });

  it("sem nenhuma variável de ambiente, retorna o default gerenciado", () => {
    expect(resolveEnvironmentConfig()).toEqual({
      id: "ministack",
      endpoint: "http://ministack:4566",
      managed: true,
    });
  });

  it("com MINISTACK_ENDPOINT customizado e managed ausente, mantém managed: true", () => {
    process.env.MINISTACK_ENDPOINT = "http://localhost:4566";

    expect(resolveEnvironmentConfig()).toEqual({
      id: "ministack",
      endpoint: "http://localhost:4566",
      managed: true,
    });
  });

  it("remove espaço em branco incidental de MINISTACK_ENDPOINT (trim)", () => {
    process.env.MINISTACK_ENDPOINT = "  http://localhost:4566  ";

    expect(resolveEnvironmentConfig().endpoint).toBe("http://localhost:4566");
  });

  it("MINISTACK_ENDPOINT só com espaços cai no default, não é tratado como customizado", () => {
    process.env.MINISTACK_ENDPOINT = "   ";

    expect(resolveEnvironmentConfig().endpoint).toBe("http://ministack:4566");
  });

  it.each(["true", "TRUE", "True"])(
    "aceita MINISTACK_MANAGED=%s (case-insensitive)",
    (value) => {
      process.env.MINISTACK_MANAGED = value;

      expect(resolveEnvironmentConfig().managed).toBe(true);
    },
  );

  it("com managed: false e endpoint customizado, reflete exatamente os dois", () => {
    process.env.MINISTACK_MANAGED = "false";
    process.env.MINISTACK_ENDPOINT = "http://host.docker.internal:4566";

    expect(resolveEnvironmentConfig()).toEqual({
      id: "ministack",
      endpoint: "http://host.docker.internal:4566",
      managed: false,
    });
  });

  it("lança InvalidEnvironmentConfigError quando managed: false sem endpoint", () => {
    process.env.MINISTACK_MANAGED = "false";

    expect(() => resolveEnvironmentConfig()).toThrow(
      InvalidEnvironmentConfigError,
    );
  });

  it("lança InvalidEnvironmentConfigError para um valor de MINISTACK_MANAGED não reconhecível", () => {
    process.env.MINISTACK_MANAGED = "talvez";

    expect(() => resolveEnvironmentConfig()).toThrow(
      InvalidEnvironmentConfigError,
    );
  });
});
