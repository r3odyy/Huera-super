const { Client, GatewayIntentBits, Partials, Collection, REST, Routes } = require('discord.js');
const { joinVoiceChannel, VoiceConnectionStatus } = require('@discordjs/voice');
const fs = require('fs');
const path = require('path');

// تحميل الإعدادات
let config = {};
try {
  config = require('./config.json');
} catch (e) {
  console.error('❌ لم يتم العثور على ملف config.json أو يحتوي على أخطاء بتنسيق JSON!');
}

const token = config.bot ? config.bot.token : config.token;
const clientId = config.bot ? config.bot.clientId : config.clientId;
const guildId = config.server ? config.server.guildId : config.guildId;
const voiceChannelId = config.voiceChannelId || (config.server ? config.server.voiceChannelId : null);

// إنشاء العميل بالحسابات والإذونات المطلوبة
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildVoiceStates
  ],
  partials: [Partials.Channel, Partials.Message, Partials.User, Partials.GuildMember]
});

client.config = config;
client.commands = new Collection();

// ----------------------------------------------------
// 1. تحميل الأوامر (Slash Commands)
// ----------------------------------------------------
const commands = [];
const handlerPath = path.join(__dirname, 'Handler');

function loadCommands(dir) {
  if (!fs.existsSync(dir)) return;
  const files = fs.readdirSync(dir);
  for (const file of files) {
    const fullPath = path.join(dir, file);
    const stat = fs.statSync(fullPath);
    if (stat.isDirectory()) {
      loadCommands(fullPath);
    } else if (file.endsWith('.js')) {
      const command = require(fullPath);
      if (command && command.data && command.execute) {
        client.commands.set(command.data.name, command);
        commands.push(command.data.toJSON());
        console.log(`✅ تم تحميل الأمر: /${command.data.name}`);
      }
    }
  }
}

loadCommands(handlerPath);

// ----------------------------------------------------
// 2. حدث الجاهزية (Ready Event) + الاتصال بالروم الصوتي
// ----------------------------------------------------
client.once('ready', async () => {
  console.log(`🚀 تم تشغيل البوت بنجاح باسم: ${client.user.tag}`);

  // تسجيل أوامر السلاش في ديسكورد
  if (token && clientId) {
    const rest = new REST({ version: '10' }).setToken(token);
    try {
      if (guildId) {
        await rest.put(Routes.applicationGuildCommands(clientId, guildId), { body: commands });
        console.log('✅ تم تحديث أوامر السلاش في السيرفر.');
      } else {
        await rest.put(Routes.applicationCommands(clientId), { body: commands });
        console.log('✅ تم تحديث أوامر السلاش عامة.');
      }
    } catch (err) {
      console.error('❌ خطأ أثناء تسجيل أوامر السلاش:', err);
    }
  }

  // دخول الروم الصوتي تلقائياً
  if (voiceChannelId) {
    const targetGuild = guildId ? client.guilds.cache.get(guildId) : client.guilds.cache.first();
    if (targetGuild) {
      try {
        const connection = joinVoiceChannel({
          channelId: voiceChannelId,
          guildId: targetGuild.id,
          adapterCreator: targetGuild.voiceAdapterCreator,
          selfDeaf: true,
          selfMute: false
        });

        connection.on(VoiceConnectionStatus.Ready, () => {
          console.log(`🔊 تم الانضمام بنجاح إلى الروم الصوتي: ${voiceChannelId}`);
        });

        connection.on(VoiceConnectionStatus.Disconnected, () => {
          console.warn('⚠️ تم الانفصال عن الروم الصوتي، جاري إعادة المحاولة...');
        });
      } catch (err) {
        console.error('❌ فشل الدخول للروم الصوتي:', err.message);
      }
    } else {
      console.warn('⚠️ لم يتم العثور على السيرفر المحدد للروم الصوتي.');
    }
  } else {
    console.log('ℹ️ لم يتم تحديد آيدي روم صوتي (voiceChannelId) في الإعدادات.');
  }
});

// ----------------------------------------------------
// 3. معالجة التفاعلات (Interaction Handling)
// ----------------------------------------------------
const ticketHandler = require('./modals/ticket-modal');

client.on('interactionCreate', async (interaction) => {
  try {
    // أورمر السلاش
    if (interaction.isChatInputCommand()) {
      const command = client.commands.get(interaction.commandName);
      if (!command) return;
      await command.execute(interaction, client);
      return;
    }

    // تفاعلات التذاكر (القوائم المنسدلة - المودال - الأزرار)
    if (
      interaction.isStringSelectMenu() ||
      interaction.isModalSubmit() ||
      interaction.isButton()
    ) {
      if (ticketHandler && typeof ticketHandler.handleInteraction === 'function') {
        await ticketHandler.handleInteraction(interaction, client);
      }
    }
  } catch (error) {
    console.error('❌ خطأ أثناء معالجة التفاعل:', error);
    if (!interaction.replied && !interaction.deferred) {
      await interaction.reply({
        content: '❌ حدث خطأ غير متوقع أثناء معالجة الطلب!',
        ephemeral: true
      }).catch(() => {});
    }
  }
});

// ----------------------------------------------------
// 4. الحماية من توقف البوت عند الأخطاء المفتوحة
// ----------------------------------------------------
process.on('unhandledRejection', (reason, promise) => {
  console.error('⚠️ خطأ غير معالج (Unhandled Rejection):', reason);
});

process.on('uncaughtException', (err, origin) => {
  console.error('⚠️ استثناء غير ملتقط (Uncaught Exception):', err);
});

// تسجيل الدخول
if (token) {
  client.login(token);
} else {
  console.error('❌ التوكن غير موجود في config.json!');
}