const { 
  EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, 
  ModalBuilder, TextInputBuilder, TextInputStyle, 
  ChannelType, PermissionFlagsBits, StringSelectMenuBuilder, StringSelectMenuOptionBuilder 
} = require('discord.js');
const { getPanels, getNextTicketNumber, getTicketCount } = require('../units/dataManager');

/**
 * دالة إنشاء القائمة المنسدلة لفتح التذاكر مع عرض العداد
 */
function createTicketMenu(guildId, panelId = 'default') {
  const ticketCount = getTicketCount ? getTicketCount(guildId) : 0;

  const selectMenu = new StringSelectMenuBuilder()
    .setCustomId(`ticket_select_${panelId}`)
    .setPlaceholder('...اختر القسم المناسب لفتح تذكرة')
    .addOptions(
      new StringSelectMenuOptionBuilder()
        .setLabel('الدعم الفني')
        .setValue('support_ticket')
        .setDescription(`عدد التذاكر المفتوحة حالياً: ${ticketCount}`)
        .setEmoji('🎫'),
      new StringSelectMenuOptionBuilder()
        .setLabel('الإدارة')
        .setValue('admin_ticket')
        .setDescription(`عدد التذاكر المفتوحة حالياً: ${ticketCount}`)
        .setEmoji('🛠️')
    );

  return new ActionRowBuilder().addComponents(selectMenu);
}

module.exports = {
  createTicketMenu,
  async handleInteraction(interaction, client) {
    const { roles, server } = client.config || {};
    const isOwner = server?.ownerId ? interaction.user.id === server.ownerId : false;
    const isStaff = (roles?.staffRoleId && interaction.member?.roles?.cache?.has(roles.staffRoleId)) || 
                   (roles?.highStaffRoleId && interaction.member?.roles?.cache?.has(roles.highStaffRoleId)) || 
                   isOwner;

    // 1. عند إختيار قسم من القائمة المنسدلة -> إظهار الـ Modal فوراً لمنع مهلة الـ 3 ثوانٍ
    if (interaction.isStringSelectMenu()) {
      if (interaction.customId.startsWith('ticket_select_') || interaction.customId === 'ticket_select_menu') {
        const panelId = interaction.customId.includes('ticket_select_') 
          ? interaction.customId.replace('ticket_select_', '') 
          : 'default';

        const modal = new ModalBuilder()
          .setCustomId(`ticket_modal_${panelId}`)
          .setTitle('سبب فتح التذكرة');

        const reasonInput = new TextInputBuilder()
          .setCustomId('ticket_reason')
          .setLabel('ما هي مشكلتك أو استفسارك؟')
          .setStyle(TextInputStyle.Paragraph)
          .setPlaceholder('اكتب التفاصيل هنا...')
          .setRequired(true);

        modal.addComponents(new ActionRowBuilder().addComponents(reasonInput));
        
        await interaction.showModal(modal);
        return;
      }
    }

    // 2. عند تقديم الـ Modal -> إنشاء روم التذكرة
    if (interaction.isModalSubmit() && interaction.customId.startsWith('ticket_modal_')) {
      // تأخير الرد فوراً لتفادي "didn't respond in time" أثناء إنشاء الروم
      await interaction.deferReply({ ephemeral: true });

      const panelId = interaction.customId.replace('ticket_modal_', '');
      const panels = getPanels ? getPanels() : {};
      const panel = panels[panelId] || {};
      const reason = interaction.fields.getTextInputValue('ticket_reason');

      const ticketNum = getNextTicketNumber ? getNextTicketNumber() : Math.floor(Math.random() * 1000);
      const guild = interaction.guild;

      const channelOptions = {
        name: `support-${ticketNum}`,
        type: ChannelType.GuildText,
        permissionOverwrites: [
          { id: guild.id, deny: [PermissionFlagsBits.ViewChannel] },
          { id: interaction.user.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.AttachFiles] }
        ]
      };

      if (roles?.staffRoleId) {
        channelOptions.permissionOverwrites.push({
          id: roles.staffRoleId,
          allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages]
        });
      }

      if (panel.openCatId) channelOptions.parent = panel.openCatId;

      const ticketChannel = await guild.channels.create(channelOptions);

      await interaction.editReply({ content: `✅ تم فتح تذكرتك بنجاح: ${ticketChannel}` });

      if (roles?.staffRoleId) {
        await ticketChannel.send({
          content: `<@&${roles.staffRoleId}> Alerted —— A staff member will be with you Shortly`
        });
      }

      // الإمبد الفضي (#C0C0C0)
      const mainEmbed = new EmbedBuilder()
        .setTitle(`🎟 Support ${ticketNum}`)
        .setDescription(`📌 Support · 👥 Unclaimed\n\n**Opened by:** <@${interaction.user.id}> (${interaction.user.username})\n**Created:** <t:${Math.floor(Date.now() / 1000)}:R>\n**Tickets:** ${ticketNum} total\n**Claimed by:** No one\n\n----------------------------------------\n\n**What do you need help with?**\n\`\`\`${reason}\`\`\``)
        .setColor('#C0C0C0');

      if (panel.ticketImg) mainEmbed.setThumbnail(panel.ticketImg);

      const actionRow = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId(`btn_claim_${panelId}`).setLabel('CLAIM').setEmoji('📌').setStyle(ButtonStyle.Secondary),
        new ButtonBuilder().setCustomId(`btn_close_${panelId}`).setLabel('CLOSE').setEmoji('🔒').setStyle(ButtonStyle.Danger),
        new ButtonBuilder().setCustomId('btn_add_user').setLabel('ADD USER').setEmoji('👤').setStyle(ButtonStyle.Secondary)
      );

      const pinnedMsg = await ticketChannel.send({ embeds: [mainEmbed], components: [actionRow] });
      await pinnedMsg.pin().catch(() => {});

      // إمبد المساعد
      const assistantEmbed = new EmbedBuilder()
        .setTitle('🛠️ Support Assistant')
        .setDescription(`Hello! Thank you for reaching out to **${guild.name}**. Could you please provide more details about what you need assistance with?`)
        .setColor('#2b2d31');

      const assistantRow = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId('btn_arabic').setLabel('Arabic').setEmoji('🌐').setStyle(ButtonStyle.Secondary),
        new ButtonBuilder().setCustomId('btn_talk_staff').setLabel('Talk to Staff').setEmoji('👤').setStyle(ButtonStyle.Secondary)
      );

      await ticketChannel.send({ embeds: [assistantEmbed], components: [assistantRow] });
      return;
    }

    // 3. التفاعل مع الأزرار داخل التذكرة
    if (interaction.isButton()) {

      // زر الاستلام Claim / Unclaim
      if (interaction.customId.startsWith('btn_claim_')) {
        if (!isStaff) return interaction.reply({ content: '❌ هذا الإجراء لموظفي الدعم الفني فقط!', ephemeral: true });

        const embed = EmbedBuilder.from(interaction.message.embeds[0]);
        let desc = embed.data.description;

        if (desc.includes('👥 Unclaimed')) {
          desc = desc.replace('👥 Unclaimed', `👤 Claimed by ${interaction.user.username}`);
          desc = desc.replace('**Claimed by:** No one', `**Claimed by:** <@${interaction.user.id}>`);
          embed.setDescription(desc);

          if (roles?.staffRoleId) {
            await interaction.channel.permissionOverwrites.set([
              { id: interaction.guild.id, deny: [PermissionFlagsBits.ViewChannel] },
              { id: roles.staffRoleId, deny: [PermissionFlagsBits.SendMessages] },
              { id: interaction.user.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages] }
            ]);
          }

          const row = ActionRowBuilder.from(interaction.message.components[0]);
          row.components[0].setLabel('UNCLAIM').setStyle(ButtonStyle.Danger);

          await interaction.update({ embeds: [embed], components: [row] });
          await interaction.followUp({ content: `✅ تم استلام التذكرة بواسطة <@${interaction.user.id}>` });
        } else {
          desc = desc.replace(/👤 Claimed by .*/, '👥 Unclaimed');
          desc = desc.replace(/\*\*Claimed by:\*\* <@.*>/, '**Claimed by:** No one');
          embed.setDescription(desc);

          if (roles?.staffRoleId) {
            await interaction.channel.permissionOverwrites.set([
              { id: interaction.guild.id, deny: [PermissionFlagsBits.ViewChannel] },
              { id: roles.staffRoleId, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages] }
            ]);
          }

          const row = ActionRowBuilder.from(interaction.message.components[0]);
          row.components[0].setLabel('CLAIM').setStyle(ButtonStyle.Secondary);

          await interaction.update({ embeds: [embed], components: [row] });
        }
        return;
      }

      // زر الإغلاق والمسح Close / Delete
      if (interaction.customId.startsWith('btn_close_')) {
        const panelId = interaction.customId.replace('btn_close_', '');
        const panels = getPanels ? getPanels() : {};
        const panel = panels[panelId] || {};

        const row = ActionRowBuilder.from(interaction.message.components[0]);

        if (row.components[1].data.label === 'CLOSE') {
          row.components[1].setLabel('DELETE').setStyle(ButtonStyle.Danger);
          await interaction.update({ components: [row] });

          if (panel.closedCatId) {
            await interaction.channel.setParent(panel.closedCatId).catch(() => {});
          }

          await interaction.channel.send('🔒 **تم إغلاق التذكرة ونقلها إلى أرشيف التذاكر المغلقة.**');
        } else if (row.components[1].data.label === 'DELETE') {
          if (!isOwner) return interaction.reply({ content: '❌ مسح التذكرة مخصص للأونر فقط!', ephemeral: true });

          await interaction.reply('🗑 جاري حفظ المحادثات وإرسال الترانسكريبت ثم حذف التذكرة...');

          const fetchedMessages = await interaction.channel.messages.fetch({ limit: 100 });
          const formattedLog = fetchedMessages.reverse().map(m => {
            return `[${new Date(m.createdTimestamp).toLocaleString()}] ${m.author.tag}: ${m.content}`;
          }).join('\n');

          const buffer = Buffer.from(formattedLog, 'utf-8');
          const attachment = { attachment: buffer, name: `${interaction.channel.name}-transcript.txt` };

          if (panel.logChannelId) {
            const logChannel = interaction.guild.channels.cache.get(panel.logChannelId);
            if (logChannel) {
              const logEmbed = new EmbedBuilder()
                .setTitle(`📝 Ticket Log - ${interaction.channel.name}`)
                .setColor('#ff0000')
                .addFields(
                  { name: 'Ticket Channel', value: interaction.channel.name, inline: true },
                  { name: 'Deleted By', value: `<@${interaction.user.id}>`, inline: true },
                  { name: 'Date', value: `<t:${Math.floor(Date.now() / 1000)}:F>`, inline: false }
                );

              await logChannel.send({ embeds: [logEmbed], files: [attachment] }).catch(console.error);
            }
          }

          setTimeout(() => interaction.channel.delete().catch(() => {}), 3000);
        }
        return;
      }

      // زر إضافة عضو Add User
      if (interaction.customId === 'btn_add_user') {
        if (!isStaff) return interaction.reply({ content: '❌ هذا الإجراء للإدارة فقط!', ephemeral: true });

        const modal = new ModalBuilder().setCustomId('modal_add_user').setTitle('إضافة عضو للتذكرة');
        const userInput = new TextInputBuilder().setCustomId('user_id').setLabel('أدخل ID العضو').setStyle(TextInputStyle.Short).setRequired(true);
        modal.addComponents(new ActionRowBuilder().addComponents(userInput));
        await interaction.showModal(modal);
        return;
      }

      // زر التحويل إلى العربية
      if (interaction.customId === 'btn_arabic') {
        const embed = EmbedBuilder.from(interaction.message.embeds[0])
          .setDescription(`مرحباً بك! شكراً لتواصلك مع **${interaction.guild.name}**. برجاء كتابة باقي تفاصيل مشكلتك أو استفسارك بشكل كامل للتعامل معها في أسرع وقت.`);

        await interaction.update({ embeds: [embed] });
        return;
      }

      // زر التحدث مع الطاقم
      if (interaction.customId === 'btn_talk_staff') {
        if (!isOwner) return interaction.reply({ content: '❌ هذا الزر مخصص للأونر فقط!', ephemeral: true });

        if (roles?.staffRoleId) {
          await interaction.channel.send({ content: `<@&${roles.staffRoleId}> **Staff required as soon as possible!**` });
        }
        await interaction.reply({ content: '📢 تم نداء فريق الإدارة بنجاح.', ephemeral: true });
        return;
      }
    }

    // 4. معالجة Modal إضافة عضو
    if (interaction.isModalSubmit() && interaction.customId === 'modal_add_user') {
      const userId = interaction.fields.getTextInputValue('user_id');
      try {
        await interaction.channel.permissionOverwrites.edit(userId, { ViewChannel: true, SendMessages: true });
        await interaction.reply({ content: `✅ تم إضافة <@${userId}> للتذكرة بنجاح!` });
      } catch (e) {
        await interaction.reply({ content: '❌ لم يتم العثور على هذا العضو أو ID غير صحيح.', ephemeral: true });
      }
    }
  }
};