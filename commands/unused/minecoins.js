"use strict";

const { getVirtualCurrency } = require("../../common/playfab.js");

module.exports = {
	name: "minecoins",
	description: "Find how much minecoins your linked account has",
	requireLink: true,
	execute: async (interaction, args, dbUser) => {
		const virtualCurrency = await getVirtualCurrency(dbUser.id);
		if(virtualCurrency.errorMsg) return interaction.createFollowup({content:`Unable to get total minecoins count.\nError: ${virtualCurrency.errorMsg}`});

		const minecoins = virtualCurrency.Currencies.find(currency => currency === "ecd19d3c-7635-402c-a185-eb11cb6c6946")?.Amount ?? 0;

		interaction.createFollowup(`Your account currently has **${minecoins}** minecoins.`);
	}
};
