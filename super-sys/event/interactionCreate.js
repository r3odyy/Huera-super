module.exports = {
  name: 'interactionCreate',
  async execute(interaction, client) {
    // 1. التعامل مع أوامر السلاش (Slash Commands)
    if (interaction.isChatInputCommand()) {
      const command = client.slashCommands.get(interaction.commandName);
      if (!command) return;

      const { roles, server } = client.config;
      const member = interaction.member;
      const userId = interaction.user.id;

      // فحص الصلاحيات حسب القسم الخاص بالأمر
      if (command.category === 'hightStaff') {
        const hasHighStaff = member.roles.cache.has(roles.highStaffRoleId);
        const isOwner = userId === server.ownerId;
        if (!hasHighStaff && !isOwner) {
          return interaction.reply({
            content: '❌ هذا الأمر مخصص للإدارة العليا فقط!',
            ephemeral: true
          });
        }
      } else if (command.category === 'staff') {
        const hasStaff = member.roles.cache.has(roles.staffRoleId);
        const hasHighStaff = member.roles.cache.has(roles.highStaffRoleId);
        const isOwner = userId === server.ownerId;
        if (!hasStaff && !hasHighStaff && !isOwner) {
          return interaction.reply({
            content: '❌ هذا الأمر مخصص للإدارة فقط!',
            ephemeral: true
          });
        }
      }

      // تنفيذ الأمر
      try {
        await command.execute(interaction, client);
      } catch (error) {
        console.error(`❌ Error executing slash command (${interaction.commandName}):`, error);
        const replyOptions = { content: '❌ حدث خطأ أثناء تنفيذ هذا الأمر!', ephemeral: true };
        if (interaction.replied || interaction.deferred) {
          await interaction.followUp(replyOptions).catch(() => {});
        } else {
          await interaction.reply(replyOptions).catch(() => {});
        }
      }
    }

  }
};                                                                                                                              