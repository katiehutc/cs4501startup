import { describe, expect, it } from "vitest";
import { FakeLlmClient } from "./client";
import { makeExtractor } from "./extract";

interface SchemaNode {
  type?: string | string[];
  properties?: Record<string, SchemaNode>;
  items?: SchemaNode;
  anyOf?: SchemaNode[];
  required?: string[];
  additionalProperties?: unknown;
  [keyword: string]: unknown;
}

function children(node: SchemaNode): SchemaNode[] {
  return [...Object.values(node.properties ?? {}), ...(node.items ? [node.items] : []), ...(node.anyOf ?? [])];
}

function allNodes(node: SchemaNode): SchemaNode[] {
  return [node, ...children(node).flatMap(allNodes)];
}

function allowsNull(node: SchemaNode): boolean {
  const types = Array.isArray(node.type) ? node.type : [node.type];
  return types.includes("null") || (node.anyOf ?? []).some(allowsNull);
}

function objectBranch(node: SchemaNode): SchemaNode {
  return node.properties ? node : (node.anyOf ?? []).filter((n) => n.properties)[0];
}

async function requestedSchema(): Promise<SchemaNode> {
  const client = new FakeLlmClient([{}]);
  await makeExtractor(client)("coffee w/ Chris", "2026-10-21", []);
  return client.calls[0].schema as SchemaNode;
}

describe("#44 makeExtractor schema", () => {
  it("[ai] requires every Extraction field at the top level", async () => {
    const schema = await requestedSchema();
    expect(schema.required).toEqual(expect.arrayContaining(["contact", "chatDate", "referrals", "followUp", "evidence"]));
  });

  it("[ai] allows null only where the contract does", async () => {
    const schema = await requestedSchema();
    const contact = schema.properties?.contact as SchemaNode;
    const fields = contact.properties as Record<string, SchemaNode>;
    expect(allowsNull(schema.properties?.followUp as SchemaNode)).toBe(true);
    expect(["title", "group", "city"].every((name) => allowsNull(fields[name]))).toBe(true);
    expect(allowsNull(fields.name)).toBe(false);
    expect(allowsNull(fields.firmText)).toBe(false);
  });

  it("[ai] closes every object and requires all of its properties, as the API demands", async () => {
    const schema = await requestedSchema();
    const objects = allNodes(schema).filter((node) => node.properties);
    expect(objects.length).toBeGreaterThan(0);
    for (const node of objects) {
      expect(node.additionalProperties).toBe(false);
      expect([...(node.required ?? [])].sort()).toEqual(Object.keys(node.properties ?? {}).sort());
    }
  });

  it("[ai] avoids keywords the API rejects with a 400", async () => {
    const schema = await requestedSchema();
    const rejected = ["minimum", "maximum", "exclusiveMinimum", "exclusiveMaximum", "multipleOf", "minLength", "maxLength", "maxItems"];
    for (const node of allNodes(schema)) {
      expect(Object.keys(node).filter((key) => rejected.includes(key))).toEqual([]);
    }
  });

  it("[ai] asks for followUp as an object with afterDays and reason when present", async () => {
    const schema = await requestedSchema();
    const followUp = objectBranch(schema.properties?.followUp as SchemaNode);
    expect(Object.keys(followUp.properties ?? {}).sort()).toEqual(["afterDays", "reason"]);
  });
});
