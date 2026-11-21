# Unbroke

A budgeting and expense app. You can install it on your phone's home screen, and it stays in two-way sync with your own Google Sheet.

```
app/           React + Vite web app (installable PWA)
apps-script/   Code.gs + appsscript.json: the backend that lives inside each user's Google Sheet
```

## How it works

- **The sheet is the database.** Each user has their own Google Sheet with a small Apps Script attached. The app reads and writes through that script's web-app URL.
- **Two-way sync.** The app checks a cheap "version" stamp every 12 seconds, and also whenever the app regains focus or comes back online. It downloads everything again only when something changed. Edits typed straight into the sheet bump the stamp through `onEdit` / `onChange` triggers, so they show up in the app within seconds. Rows you add by hand get an ID automatically, and any new category or account name you type is added to its list.
- **Offline first.** Changes apply instantly on screen and wait in a queue that syncs when you're back online.
- **Scheduled and recurring expenses** are recorded by an **hourly time trigger inside the sheet**, so they're posted on the due date even if nobody opens the app.
- **Receipts** are shrunk on the device, then saved in a `Unbroke Receipts` folder in the owner's Google Drive. Each receipt is shared as view-only to anyone who has the link, so the app can show it.

### Sheet tabs (all created automatically)

| Tab | Columns |
|---|---|
| Transactions | ID, Date, Time, Amount, Category, Account, Note, Receipt, Source, Created, Updated |
| Categories | ID, Name, Icon, Color, Order, Archived |
| Accounts | ID, Name, Type, Icon, Color, Order, Archived |
| Budgets | ID, Name, Period (weekly/monthly), Amount, Category (blank = all spending), Created |
| Scheduled | ID, Title, Amount, Category, Account, Note, Frequency, Interval, Start Date, End Date, Max Runs, Runs, Next Date, Active, Last Run, Created |
| Settings | Key, Value (currency, weekStart) |

Categories and accounts are stored **by name** in Transactions, so the sheet stays readable and easy to edit by hand. Renaming one in the app also updates every row that uses it.

## 1. Create the template sheet (once, by you)

1. Make a new sheet at <https://sheets.new> and name it, e.g. "Unbroke".
2. Open **Extensions › Apps Script**. Paste in `apps-script/Code.gs`. To use the slimmer permissions, open **Project Settings**, tick *Show "appsscript.json"*, and paste in `apps-script/appsscript.json`. Save.
3. Share the sheet as **Anyone with the link: Viewer**. Copy its URL and swap the ending `/edit…` for `/copy`. That link is your **template link**.

## 2. Host the app

```bash
cd app
npm install
npm run build
```

Upload `app/dist/` to any static host. It's built with relative paths, so a sub-folder works too.

- **Vercel / Netlify**: set the project root to `app`, the build command to `npm run build`, and the output folder to `dist`.
- **GitHub Pages**: publish the `dist` folder.

To give friends one-click setup, set the template link as an environment variable when you build:

```bash
VITE_TEMPLATE_URL="https://docs.google.com/spreadsheets/d/<id>/copy" npm run build
```

Without it, onboarding shows the "From scratch" steps instead, with a **Copy script** button.

## 3. Connect (each person does this once)

1. Open the template link and choose **Make a copy**.
2. In the copy, open **Extensions › Apps Script › Deploy › New deployment › Web app**. Set *Execute as: Me* and *Who has access: Anyone*, then Deploy.
3. Authorise the script. It's your own, so click **Advanced › Go to project (unsafe) › Allow**.
4. Paste the **Web app URL** into the app. The app creates every tab and column, adds default categories and accounts, and turns on the hourly scheduler.

Each person's data stays in their own Drive. Nobody else's script can read it.

> **Updating the script later:** paste the new `Code.gs`, then go to **Deploy › Manage deployments › Edit › Version: New version**. The URL stays the same.

## Optional: add expenses with iPhone Back Tap

Double-tap the back of the phone, type or dictate something like `swiggy 340 upi note team dinner`, and it's saved straight to the sheet without opening the app. Setup steps are in **Settings › Shortcuts › Add with iPhone Back Tap** inside the app. This needs script version 2 or later (the `quick` action), so sheets set up earlier must paste the latest `Code.gs` and choose **Deploy › Manage deployments › Edit › New version**.

The script takes `POST {"action":"quick","text":"…","format":"text"}` and replies with one line such as `✓ Added ₹340 · Food & Dining · UPI`. Parsing works the same as in-app quick add (`app/src/lib/quickadd.ts`, mirrored by `parseQuick_` in `Code.gs`).

## Privacy note

The web-app URL works like a password: anyone who has it can read and write that sheet. Keep it private. If it ever leaks, go to **Deploy › Manage deployments**, archive the old deployment, create a new one, and paste the new URL into the app.

## Local development

```bash
cd app
npm install
npm run dev
```

Choose **Try it with sample data** to explore the app without a sheet. Demo mode keeps its data in the browser only, and it runs scheduled expenses on the device.

## Features

- **Home**: spending for Today, Week, Month, Year or a custom range, compared with the same point in the previous period, plus a pace projection and cumulative sparkline. Also quick add, recent expenses, budget gauges with *safe to spend per day* (scheduled bills still due are subtracted first), and upcoming scheduled expenses.
- **Analysis**: Week, Month, Year or Custom. Includes a trend chart with an average line, a category and account donut chart with lists, six stats, and automatic insights (biggest category changes, busiest weekday, weekend spending, unusual expenses, how much went to scheduled bills).
- **Accounts**: as many as you like (cash, bank, card, UPI, wallet), each with spending for the month.
- **Transactions**: Day view, a Calendar heatmap, and a Custom view filtered by date range, categories, accounts, amount and search text, with sorting.
- **Budgets**: weekly or monthly, for all spending or a single category.
- **Scheduled**: one-off or every N days, weeks, months or years, ending never, on a date, or after N payments. You can pause and resume them.
- **Export**: PDF reports and Excel workbooks (Summary, Transactions, By category, By account, By month) for any range or filter.
- **Other**: notes, receipt photos, keypad with arithmetic (`120+45`), light and dark themes that follow your system, installable PWA, and `N` as a keyboard shortcut for a new expense on desktop.
