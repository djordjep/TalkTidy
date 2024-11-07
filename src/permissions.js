chrome.declarativeNetRequest.updateDynamicRuleset({
  id: "my-rule-set",
  rules: [
    {
      id: "allow-firebase",
      priority: 1,
      condition: {
        urlFilter: ["https://*.firebaseio.com/*", "https://apis.google.com/auth/*"],
        resourceTypes: ["script", "main_frame", "sub_frame", "object", "image", "media", "font", "css"]
      },
      action: {
        type: "allow"
      }
    }
  ]
}, () => {
  console.log("Rules updated successfully");
});