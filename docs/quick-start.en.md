# Quick Start Guide

[日本語](./quick-start.md) | [Tiếng Việt](./quick-start.vi.md)

No engineering experience needed! Follow this guide to start using Claude Code, an AI coding assistant, right away.

---

## Method A: Setup Script (Recommended)

**Estimated time: 5–10 minutes**

Just double-click a file to complete the setup. No terminal knowledge required.

### Step 1: Download the Code

Click the link below to download the ZIP file:

👉 [**Download ZIP**](https://github.com/sun-asterisk-internal/sun-nextjs-template/archive/refs/heads/main.zip)

> If the link doesn't work, open [the repository page](https://github.com/sun-asterisk-internal/sun-nextjs-template), click the green "Code" button, then "Download ZIP".

#### After downloading

1. **Double-click** the downloaded ZIP file to extract it
2. Move the extracted folder to your preferred location (Desktop, Documents, etc.)

> 💡 **Want to rename the folder?** The folder name becomes your project name. Feel free to rename it (e.g., `my-project`, `todo-app`). **Do not use spaces or non-ASCII characters** — stick to letters, numbers, and hyphens (`-`).
>
> - ⭕ Good: `my-project`, `todo-app`, `company-website`
> - ❌ Bad: `My Project` (has a space), `マイプロジェクト`

### Step 2: Run the Setup Script

Open the extracted folder and **double-click** the following file:

| OS | File to double-click |
|----|---------------------|
| Mac | `setup.command` |
| Windows | `setup.bat` |

> **Mac shows "Apple cannot verify it is free of malware" or "unidentified developer" warning**:
> 1. Click **"OK"** to dismiss the warning dialog
> 2. Open **System Settings** ( menu → System Settings)
> 3. Click **"Privacy & Security"**
> 4. Scroll down — you'll see a message that `"setup.command"` was blocked
> 5. Click **"Open Anyway"**
> 6. Enter your Mac password when prompted
>
> ![macOS Privacy & Security settings showing the "Open Anyway" button](./images/macos-gatekeeper-allow.png)
>
> This is a macOS security feature (Gatekeeper) that warns about files downloaded from the internet. It's safe to proceed.

#### Follow the on-screen prompts

A terminal window will open automatically with the following prompt:

```
🎉 Sun* Next.js Template Setup
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  How much do you want to set up?

    1. Just Claude Code
       Enables AI-assisted coding with natural language

    2. Build apps too
       Also installs dependencies so you can start building right away

  Enter a number (1 or 2):
```

Just **type a number and press Enter** — the necessary tools will be installed automatically.

| Course | What gets installed? | Recommended for |
|--------|---------------------|-----------------|
| 1 | Bun + Claude Code | People who want to try Claude Code first |
| 2 | Above + app dependencies | People who want to start building apps right away |

At the end of setup, you'll be asked **"Set up GitHub CLI too?"**. Choose "1" if you plan to share code with your team. You can always set it up later, so feel free to skip if you're not sure.

> ⚠️ **If Homebrew is needed for GitHub CLI**: During Homebrew installation, you'll be asked for your **Mac password**. On a new Mac, the **Xcode Command Line Tools** may also be installed automatically, which can take **10–30 minutes**. Even if it looks like nothing is happening, the process is still running — please wait for it to finish.

> 💡 **Glossary — What the setup script does**:
> - **Bun** — A tool that manages the "building blocks" your project needs. It works behind the scenes, so you'll rarely interact with it directly
> - **Claude Code** — An AI coding assistant. Just say "build me a Todo app" in plain language, and it writes the code for you
> - **Dependencies** (Course 2 only) — The set of building blocks needed to run your app. Think of them as "ingredients" for a recipe
> - **GitHub CLI** (optional) — A command-line tool for GitHub, a platform for sharing and managing code. Used for team development

> 💡 **Asked for a password?** On Mac, you may be prompted for a password during setup. This is your Mac login password. Nothing will appear on screen as you type — that's normal. Press Enter when done.

> **Windows users — Git setup**: Git needs to be installed separately on Windows. If you plan to collaborate with your team, follow the Git installation steps in Method B's "Step 0: Install Tools". On Mac, Git is available out of the box, so this step is not needed.

### Step 3: Try Claude Code

When setup finishes, **close the setup window** and open a new terminal window (a new terminal is needed to use the installed tools).

Open a **terminal** and follow these steps:

> 💡 **What is a "terminal"?** An app where you type commands to control your computer.
> - **Mac**: Press `Command (⌘) + Space`, type "Terminal", and open the app
> - **Windows**: Search for "PowerShell" in the Start menu and open it

1. Type `cd ` (cd followed by a space) in the terminal
2. **Drag and drop** the project folder onto the terminal window (the folder path will be filled in automatically)
3. Press Enter
4. Type `claude` and press Enter

#### First-time login

The first time you launch Claude Code, a browser window will open for login. Sign in with your Claude account (Pro / Max / Teams / Enterprise).

#### Start talking to Claude Code

Once Claude Code is running, describe what you want to build **in your own words**. No technical jargon needed!

**Example 1: Describe what you want directly**

```
Create a simple Todo app.
It should support adding tasks, checking them off, and deleting them.
```

**Example 2: Write requirements in a file and ask Claude to read it**

For complex features, it's helpful to write your requirements in a markdown file, place it in the `docs/` folder, and ask Claude Code to read it.

First, create a file like `docs/requirements.md` (you can name it anything):

```markdown
# User Management Screen Requirements

## Features
- Display a list of users in a table
- Search by name or email address
- Add new users
- Edit and delete user information

## Design
- Simple and easy-to-read design
- Mobile-friendly (responsive)
```

Then tell Claude Code:

```
Read the requirements in docs/requirements.md and implement them.
```

> 💡 This way, Claude Code understands your requirements precisely, which is very helpful for building complex features.

**Example 3: Other things you can ask**

```
Change the heading on the top page to "My Project"
```

```
Switch the entire app to a dark mode color scheme
```

```
Explain this project's structure
```

```
Make a button that shows a message when clicked
```

#### View your app (if you chose Course 2)

Open another terminal window, navigate to the project folder the same way, then run:

```bash
bun run dev
```

Then open [http://localhost:3000](http://localhost:3000) in your browser to see your app.

> 💡 `localhost:3000` is your app's address running only on your computer. It's not published on the internet, so don't worry.

---

## Additional Setup (Optional)

You can set these up at any time as needed.

### GitHub CLI Login

If you installed GitHub CLI via the setup script, you need to log in before using it. Run the following command in the terminal:

```bash
# Log in to GitHub
gh auth login -h github.com -p ssh -w
```

After running this, you'll see:

1. A **one-time code** (e.g., `AB12-3CD4`) is displayed — copy it
2. Press Enter to open the browser
3. Log in to GitHub in the browser and paste the one-time code to complete authentication
4. Follow the prompts for SSH key setup if asked

> **SSO Authorization (Sun* org members)**: After authentication, open the [SSH Keys settings page](https://github.com/settings/keys) on GitHub, click "Configure SSO" next to your SSH key, and click "Authorize" for "sun-asterisk-internal".

### Figma Integration Setup

This template comes with Figma MCP pre-configured — a feature that lets Claude Code read design data directly from Figma. If you want to build screens based on Figma designs, follow these steps to authenticate.

1. With Claude Code running, type `/mcp` and press Enter
2. If you see `figma · △ needs authentication`, use the arrow keys to select it and press Enter
3. Select "authenticate" and press Enter
4. A browser window will open — complete the authentication with your Figma account

Once authenticated, Claude Code can access your Figma design data. Just say something like "Reproduce this Figma design" and it will build the screen to match.

---

## FAQ (Frequently Asked Questions)

### Setup issues

<details>
<summary>"Not connected to the internet" error</summary>

Check your Wi-Fi or wired connection. If you're using a VPN, try disconnecting it and running the setup again.
</details>

<details>
<summary>Mac: Can't open setup.command / "Apple cannot verify it is free of malware"</summary>

This is blocked by macOS's security feature (Gatekeeper). Follow these steps to allow it:

1. Click **"OK"** to dismiss the warning dialog
2. Open **System Settings** ( menu → System Settings)
3. Click **"Privacy & Security"**
4. Scroll down — you'll see a message about `setup.command` being blocked
5. Click **"Open Anyway"**
6. Enter your Mac password when prompted

![macOS Privacy & Security settings](./images/macos-gatekeeper-allow.png)

If that still doesn't work, you can run it directly from Terminal:

1. Open **Terminal** (press `Command (⌘) + Space`, type "Terminal", and open it)
2. **Drag and drop** the `setup.command` file onto the Terminal window
3. Press Enter

This will start the setup.
</details>

<details>
<summary>Windows: "This app has been blocked for your protection"</summary>

Click "More info", then click "Run anyway". This is a Windows Defender SmartScreen warning that appears for scripts being run for the first time.
</details>

<details>
<summary>Setup stopped or failed midway</summary>

Double-click `setup.command` (Mac) or `setup.bat` (Windows) again to re-run. Tools that are already installed will be automatically skipped, so it resumes from where it left off.
</details>

### Using Claude Code

<details>
<summary>Claude Code won't start / "command not found"</summary>

Close the terminal, open a new terminal window, and type `claude`. If it still doesn't work, run the setup script again.
</details>

<details>
<summary>Can't log in to Claude Code</summary>

Claude Code requires a paid [Claude Pro / Max / Teams / Enterprise](https://claude.com/pricing) account. It does not work with the free plan. If you don't have an account, create one first.
</details>

<details>
<summary>How to exit Claude Code?</summary>

Type `/exit` or press `Ctrl + C` twice to exit.
</details>

### App development

<details>
<summary>Nothing shows up at http://localhost:3000</summary>

Make sure `bun run dev` is running. If you see a "Ready" or "started server" message in the terminal, the server is running. If not, run `bun run dev` again.
</details>

<details>
<summary>How to stop the development server?</summary>

Press `Ctrl + C` in the terminal where `bun run dev` is running.
</details>

---

If you get stuck or have questions, feel free to reach out to your team members or Kazuma Endo ([Slack](https://sun-asterisk.enterprise.slack.com/team/U033CJYTVAQ)).

---

## Method B: Manual Setup

Set up by typing commands in the terminal. This method includes Git/GitHub integration, so it's recommended for team development. If you already set up with Method A and need Git/GitHub later, just follow the Git and GitHub CLI parts in "Step 0".

### Step 0: Install Tools

The following tools are needed. Each description explains what it does.

#### Install Bun

> **What is Bun?** A package manager and runtime for JavaScript/TypeScript. It installs the libraries your project needs and runs the development server.

**Mac / Linux**:
```bash
# Install Bun
curl -fsSL https://bun.com/install | bash
```

**Windows**:
```powershell
# Install Bun
powershell -c "irm bun.sh/install.ps1 | iex"
```

After installation, close and reopen the terminal.

#### Install Git

> **What is Git?** A version control tool that tracks code changes. It records who changed what and when, making team collaboration possible.

```bash
# Check if Git is already installed
git --version
```

If no version number appears:
- **Mac**: Running the command above will trigger an automatic install dialog
- **Windows**: Download and install from [git-scm.com](https://git-scm.com/downloads/win)

#### Install GitHub CLI

> **What is GitHub CLI?** A command-line tool for GitHub, a platform for sharing and managing code. It's used for downloading code, creating pull requests, and more.

**Mac (Option 1: Using Homebrew — recommended)**:

> 💡 **What is Homebrew?** A package manager for Mac. It lets you install and update tools with a single command. If you already have it installed, or don't mind installing it, this is the easiest option.

```bash
# If Homebrew is not installed yet, install it first
/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
```

> ⚠️ **During Homebrew installation**: You'll be asked for your **Mac password**. On a new Mac, the **Xcode Command Line Tools** may also be installed automatically, which can take **10–30 minutes**. Even if it looks like nothing is happening, the process is still running — please wait.

> ⚠️ **Important step after installing Homebrew**: After installation, the screen will show **"Next steps"** with 3 commands. **Copy and paste each line one at a time and run them**. Without this step, the `brew` command won't work.
>
> Example output (for Apple Silicon Mac):
> ```
> echo >> ~/.zprofile
> echo 'eval "$(/opt/homebrew/bin/brew shellenv)"' >> ~/.zprofile
> eval "$(/opt/homebrew/bin/brew shellenv)"
> ```
> Note: The exact commands may differ slightly depending on your Mac, but just run whatever is shown on your screen.

```bash
# Install GitHub CLI
brew install gh
```

**Mac (Option 2: Install from ZIP file)**:

Download the ZIP file from the [GitHub CLI official page](https://cli.github.com/), double-click to extract it, then install with the following command:

```bash
# Install the downloaded gh command (you'll be asked for your password)
sudo cp ~/Downloads/gh_*_macOS_*/bin/gh /usr/local/bin/
```

**Windows**: Download and run the MSI installer from the [GitHub CLI official page](https://cli.github.com/).

Once installed, log in:

```bash
# Log in to GitHub (a browser window will open)
gh auth login -h github.com -p ssh -w
```

A browser window will open — follow the on-screen instructions to authenticate. Then follow the prompts for SSH key setup.

> **SSO Authorization (Sun* org members)**: After authentication, open the [SSH Keys settings page](https://github.com/settings/keys) on GitHub, click "Configure SSO" next to your SSH key, and click "Authorize" for "sun-asterisk-internal".

#### Install Claude Code

> **What is Claude Code?** An AI coding assistant. Just describe what you want in plain language, and it writes or modifies code for you.

**Mac / Linux**:
```bash
# Install Claude Code
curl -fsSL https://claude.ai/install.sh | bash
```

**Windows PowerShell**:
```powershell
# Install Claude Code
irm https://claude.ai/install.ps1 | iex
```

### Step 1: Get the Code

```bash
# Copy the template from GitHub into a folder called my-project
gh repo clone sun-asterisk-internal/sun-nextjs-template my-project

# Move into the newly created folder
cd my-project
```

> You can replace `my-project` with any project name you like (e.g., `todo-app`, `my-website`)

### Step 2: Setup

```bash
# Install all the libraries the project needs
bun install
```

### Step 3: Launch Claude Code

```bash
# Start Claude Code
claude
```

On first launch, you'll be prompted to log in. You need a [Claude Pro, Max, Teams, or Enterprise](https://claude.com/pricing) account.
