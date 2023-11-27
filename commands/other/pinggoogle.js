"use strict";

const { client } = require("../../index.js");
const axios = require("axios");

module.exports = {
  name: "ping-google",
  description: "Ping Google and get response time.",
  execute: async (interaction, args, dbUser) => {
    const { user } = interaction;

    const msg = await interaction.createFollowup({ content: "Please wait..." });

    const startTime = Date.now();

    try {
      const response = await axios.get("https://www.google.com", { timeout: 5000 }); // You can adjust the timeout as needed
      const endTime = Date.now();
      const pingTime = endTime - startTime;

      const message = `It took ${pingTime} ms to make a request to Google.`;
      msg.edit({ content: message });
    } catch (error) {
      console.error(`Error: ${error.message}`);
      msg.edit({ content: "Error while pinging Google." });
    }
  },
};
