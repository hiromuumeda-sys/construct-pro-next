import { spawn } from "node:child_process";
import { mkdir, mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

import { afterEach, expect, test } from "vitest";

const tempDirs: string[] = [];

afterEach(async () => {
  await Promise.all(
    tempDirs.map(async (dir) => {
      await import("node:fs/promises").then(({ rm }) =>
        rm(dir, { force: true, recursive: true })
      );
    })
  );
  tempDirs.length = 0;
});

async function createTempDir(prefix: string) {
  const dir = await mkdtemp(join(tmpdir(), prefix));
  tempDirs.push(dir);
  return dir;
}

async function writeExecutable(path: string, content: string) {
  await writeFile(path, content, { mode: 0o755 });
}

async function runSetupCommand({ input }: { input: string }) {
  const fakeHome = await createTempDir("setup-command-home-");
  const fakeBin = await createTempDir("setup-command-bin-");

  await mkdir(join(fakeHome, ".local", "bin"), { recursive: true });

  await writeExecutable(
    join(fakeBin, "bun"),
    '#!/bin/sh\nif [ "$1" = "--version" ]; then\n  echo 1.2.3\n  exit 0\nfi\nexit 0\n'
  );

  await writeExecutable(
    join(fakeBin, "curl"),
    "#!/bin/sh\ncat <<'EOF'\n#!/bin/sh\nexit 0\nEOF\n"
  );

  const scriptPath = resolve(process.cwd(), "setup.command");

  const result = await new Promise<{
    code: number | null;
    output: string;
  }>((resolveResult, reject) => {
    const child = spawn("bash", [scriptPath], {
      env: {
        ...process.env,
        HOME: fakeHome,
        PATH: `${fakeBin}:/usr/bin:/bin`,
        TERM: "xterm",
      },
      stdio: "pipe",
    });

    let output = "";

    child.stdout.on("data", (chunk) => {
      output += chunk.toString();
    });

    child.stderr.on("data", (chunk) => {
      output += chunk.toString();
    });

    child.on("error", reject);
    child.on("close", (code) => {
      resolveResult({ code, output });
    });

    child.stdin.write(input);
    child.stdin.end();
  });

  return result;
}

test("Given claude is still unavailable after install When running setup.command Then it shows completion message without launch option", async () => {
  const { code, output } = await runSetupCommand({
    input: "1\n2\n\n",
  });

  expect(code).toBe(0);
  expect(output).toContain(
    "Claude Code はインストールされましたが、PATHの設定が必要かもしれません"
  );
  expect(output).toContain("新しいターミナルを開いてください");
  expect(output).not.toContain("command not found");
});
