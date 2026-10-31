// 新能源智库·政策与数据资料库：法律法规、官方统计数据，每条都对照官方原文整理。
// 数据：assets/library/energy_library_v1.json；审核门禁和页面实现见 reference_library_page.dart。
import 'package:flutter/material.dart';

import 'library_binding.dart';
import 'library_strings_zh.dart';
import 'reference_library_page.dart';

const String kEnergyLibraryAsset = 'assets/library/energy_library_v1.json';

final LibraryStrings kEnergyLibraryStrings = libraryStringsZh(
  title: '政策与数据资料库',
  intro: '能源法、可再生能源法、电力法和国家能源局发布的统计数据……每一条都对照官方原文整理，写明出处、文号和读取日期。',
  footer: '这里是对法律条文和官方统计数据的整理，不是法律意见，也不构成任何投资或交易建议；以官方原文为准。未经审核的条目不会出现，也不会被 AI 当作依据。',
);

class EnergyLibraryPage extends StatelessWidget {
  const EnergyLibraryPage({super.key});

  @override
  Widget build(BuildContext context) => ReferenceLibraryPage(
        strings: kEnergyLibraryStrings,
        assetPath: kEnergyLibraryAsset,
        live: energyLibraryLiveApi(),
      );
}

/// 设置页里的入口；没有已审核条目时整行隐藏。
class EnergyLibraryEntry extends StatelessWidget {
  const EnergyLibraryEntry({super.key});

  @override
  Widget build(BuildContext context) => Padding(
        padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 4),
        child: ReferenceLibraryEntryTile(
          strings: kEnergyLibraryStrings,
          assetPath: kEnergyLibraryAsset,
          title: '政策与数据资料库',
          subtitle: '对照官方原文整理，写明出处与日期',
          onTap: () => Navigator.of(context).pushNamed('/library'),
        ),
      );
}
