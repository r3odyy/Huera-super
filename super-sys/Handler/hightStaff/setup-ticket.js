const { SlashCommandBuilder, PermissionFlagsBits, ChannelType, MessageFlags, EmbedBuilder } = require('discord.js');
const { createTicketMenu } = require('../../modals/ticket-modal');
const { savePanel } = require('../../units/dataManager');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('setup_ticket')
    .setDescription('⚙️ تسطيب وإعداد لوحة التذاكر الاحترافية الشاملة')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    // --- الإعدادات الأساسية ---
    .addChannelOption(opt => opt.setName('channel').setDescription('📌 قناة اللوحة الخارجية').addChannelTypes(ChannelType.GuildText).setRequired(true))
    .addChannelOption(opt => opt.setName('open_category').setDescription('📂 كاتيجوري التذاكر المفتوحة').addChannelTypes(ChannelType.GuildCategory).setRequired(true))
    .addChannelOption(opt => opt.setName('closed_category').setDescription('🔒 كاتيجوري التذاكر المغلقة').addChannelTypes(ChannelType.GuildCategory).setRequired(true))
    .addChannelOption(opt => opt.setName('log_channel').setDescription('📝 قناة السجلات (Logs)').addChannelTypes(ChannelType.GuildText).setRequired(true))
    .addRoleOption(opt => opt.setName('staff_role').setDescription('🛠 رتبة الدعم الفني (Staff)').setRequired(true))

    // --- الشكل الخارجي (خارج التذكرة) ---
    .addStringOption(opt => opt.setName('panel_title').setDescription('🏷️ عنوان اللوحة الخارجية').setRequired(false))
    .addStringOption(opt => opt.setName('panel_desc').setDescription('📝 وصف اللوحة الخارجية').setRequired(false))
    .addStringOption(opt => opt.setName('panel_image').setDescription('🖼️ رابط الصورة الخارجية للبانل').setRequired(false))

    // --- الشكل الداخلي (داخل التذكرة) ---
    .addStringOption(opt => opt.setName('inside_image').setDescription('🖼️ رابط الصورة الداخلية (داخل روم التذكرة)').setRequired(false))
    .addStringOption(opt => opt.setName('inside_welcome').setDescription('💬 نص الترحيب الداخلي في التذكرة').setRequired(false)),

  async execute(interaction, client) {
    try {
      await interaction.deferReply({ flags: MessageFlags.Ephemeral });

      const targetChannel = interaction.options.getChannel('channel');
      const openCategory = interaction.options.getChannel('open_category');
      const closedCategory = interaction.options.getChannel('closed_category');
      const logChannel = interaction.options.getChannel('log_channel');
      const staffRole = interaction.options.getRole('staff_role');

      // نصوص وصور الخارجي والداخلي
      const panelTitle = interaction.options.getString('panel_title') || '🎫 Super Huera Support';
      const panelDesc = interaction.options.getString('panel_desc') || 'يرجى اختيار القسم المناسب من القائمة المنسدلة لفتح تذكرة وتواصل مع فريق الدعم.';
      const panelImage = interaction.options.getString('panel_image');

      const insideImage = interaction.options.getString('inside_image');
      const insideWelcome = interaction.options.getString('inside_welcome') || 'أهلاً بك! يرجى توضيح مشكلتك بالتفصيل وسيقوم أحد أعضاء فريق الدعم بالرد عليك قريباً.';

      const panelId = 'default';

      // حفظ كافة البيانات الشاملة
      if (savePanel) {
        savePanel(panelId, {
          guildId: interaction.guild.id,
          channelId: targetChannel.id,
          openCatId: openCategory.id,
          closedCatId: closedCategory.id,
          logChannelId: logChannel.id,
          staffRoleId: staffRole.id,
          // التنسيق الخارجي والداخلي
          panelTitle,
          panelDesc,
          panelImage: panelImage || null,
          insideImage: insideImage || null,
          insideWelcome
        });
      }

      if (!client.config) client.config = {};
      if (!client.config.roles) client.config.roles = {};
      client.config.roles.staffRoleId = staffRole.id;

      // إنشاء إمبد اللوحة الخارجية
      const embed = new EmbedBuilder()
        .setTitle(panelTitle)
        .setDescription(panelDesc)
        .setColor('#C0C0C0')
        .setFooter({ text: interaction.guild.name, iconURL: interaction.guild.iconURL({ dynamic: true }) })
        .setTimestamp();

      if (panelImage) embed.setImage(panelImage);

      const menuRow = createTicketMenu(interaction.guild.id, panelId);

      await targetChannel.send({
        embeds: [embed],
        components: [menuRow]
      });

      await interaction.editReply({
        content: `✅ **تم تسطيب التذكرة الجبارة بنجاح!**\n\n📌 **القناة:** ${targetChannel}\n📂 **الكاتيجوري المفتوحة:** ${openCategory}\n🔒 **الأرشيف:** ${closedCategory}\n📝 **السجلات:** ${logChannel}\n🛠️ **رتبة الدعم:** ${staffRole}`
      });

    } catch (error) {
      console.error('❌ خطأ أثناء السيت أب:', error);
      if (interaction.deferred || interaction.replied) {
        await interaction.editReply({ content: '❌ حدث خطأ أثناء إعداد التذاكر!' });
      } else {
        await interaction.reply({ content: '❌ حدث خطأ أثناء إعداد التذاكر!', flags: MessageFlags.Ephemeral });
      }
    }
  }
};