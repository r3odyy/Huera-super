module.exports = {
  name: 'guildMemberAdd',
  async execute(member, client) {
    try {
      // جلب ID رتبة الأعضاء من ملف config.json
      const memberRoleId = client.config.roles.memberRoleId;

      if (!memberRoleId) {
        return console.log('⚠️ لم يتم تحديد memberRoleId في ملف config.json');
      }

      // البحث عن الرتبة داخل السيرفر
      const role = member.guild.roles.cache.get(memberRoleId);

      if (!role) {
        return console.log('❌ رتبة العضو غير موجودة في السيرفر، تحقق من الـ ID في config.json');
      }

      // إعطاء الرتبة للعضو الجديد
      await member.roles.add(role);
      console.log(`✅ تم إعطاء رتبة ${role.name} للعضو الجديد: ${member.user.tag}`);

    } catch (error) {
      console.error(`❌ حدث خطأ أثناء إعطاء الرتبة للعضو ${member.user.tag}:`, error);
    }
  }
};