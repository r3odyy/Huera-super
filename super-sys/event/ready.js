const { ActivityType } = require('discord.js');
const { joinVoiceChannel, VoiceConnectionStatus } = require('@discordjs/voice');
const config = require('../config.json');

module.exports = {
  name: 'ready',
  once: true,
  async execute(client) {
    console.log(`✅ Logged in as ${client.user.tag}!`);

    // 1. تفعيل وضع البث المباشر (Streaming)
    client.user.setPresence({
      activities: [{
        name: 'Super System',
        type: ActivityType.Streaming,
        url: config.streamUrl || 'https://www.twitch.tv/discord'
      }],
      status: 'online'
    });

    // 2. التثبيت الصوتي في الروم المحدد من config.json
    const connectToVoice = async () => {
      if (!config.voiceChannelId) return;

      try {
        const guild = client.guilds.cache.get(config.guildId);
        if (!guild) return console.log('❌ لم يتم العثور على السيرفر المحدد في config.json');

        const channel = guild.channels.cache.get(config.voiceChannelId);
        if (!channel || !channel.isVoiceBased()) {
          return console.log('❌ الروم الصوتي غير موجود أو ليس روم صوتي صحيح!');
        }

        const connection = joinVoiceChannel({
          channelId: channel.id,
          guildId: guild.id,
          adapterCreator: guild.voiceAdapterCreator,
          selfDeaf: true,  // كتم الصوت للبوت
          selfMute: true   // كتم المايك للبوت
        });

        // إعادة الاتصال تلقائياً إذا انقطع الاتصال
        connection.on(VoiceConnectionStatus.Disconnected, async () => {
          console.log('⚠️ انقطع اتصال البوت بالروم الصوتي، جاري إعادة الاتصال...');
          setTimeout(() => connectToVoice(), 5000);
        });

        console.log(`🎙️ تم تثبيت البوت في الروم الصوتي: ${channel.name}`);
      } catch (error) {
        console.error('❌ خطأ أثناء الاتصال بالروم الصوتي:', error);
      }
    };

    await connectToVoice();
  }
};