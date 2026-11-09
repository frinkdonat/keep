# Privacy Policy for Keep — 1-Click Watch Later

*Last updated: November 8, 2026*

This Privacy Policy explains how the **Keep — 1-Click Watch Later** Chrome extension ("the Extension") handles user data.

## 1. Single Purpose & Data Processing
The Extension is a personal utility designed solely to save the URL and title of the active browser tab to the user's own self-hosted Keep server when the user clicks the extension action icon.

## 2. Information Collected and Handled
The Extension only accesses data upon explicit user action (clicking the extension icon in the toolbar):
- **Active Tab URL and Title**: When clicked, the active tab's URL and title are read using the `activeTab` permission.
- **Server URL & API Key**: The user-configured self-hosted server destination and secret token are stored locally using the `storage` permission.
- **In-Page Feedback Toast**: The `scripting` permission is used solely to render a transient in-page notification pill confirming when a link was successfully saved or reporting an error. No webpage contents or scripts are read, recorded, or modified.

## 3. How Data is Transmitted and Stored
- **Direct Transmission**: The active tab URL and title are transmitted directly from your browser to your designated self-hosted Keep server via an HTTP/HTTPS POST request.
- **No Intermediary or Third-Party Servers**: The Extension does not communicate with any servers operated by the extension developer, Google, or any third party.
- **Local Storage**: Your configuration (Server URL and API Key) is stored strictly in your browser's local `chrome.storage.sync` area.

## 4. Data Sharing and Sale
- The Extension **does not collect, sell, rent, or trade** any personal information or browsing history.
- The Extension **does not include** any analytics, tracking scripts, advertising SDKs, or telemetry.

## 5. Contact & Source Code
The Extension is open-source. For inquiries or questions regarding this Privacy Policy, please open an issue on the project repository:
[https://github.com/frinkdonat/keep](https://github.com/frinkdonat/keep)
