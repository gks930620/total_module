import 'package:flutter/material.dart';

import '../theme/halo_theme.dart';
import '../theme/halo_flourish.dart';

/// Halo 입력창 — 라벨은 위에 작게(muted2), 입력면은 [HaloTokens.soft] + 둥글기 13.
/// 테두리는 포커스일 때만 [HaloTokens.point] 로 나타난다.
class HaloTextField extends StatelessWidget {
  const HaloTextField({
    super.key,
    required this.controller,
    required this.label,
    this.hint,
    this.keyboardType,
    this.maxLines = 1,
    this.required = false,
    this.validator,
  });

  final TextEditingController controller;
  final String label;
  final String? hint;
  final TextInputType? keyboardType;
  final int maxLines;
  final bool required;
  final String? Function(String?)? validator;

  @override
  Widget build(BuildContext context) {
    final t = context.halo;

    return Padding(
      padding: const EdgeInsets.only(bottom: HaloSpace.lg),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Padding(
            padding: const EdgeInsets.only(
              left: HaloSpace.xs,
              bottom: HaloSpace.sm,
            ),
            child: Text.rich(
              TextSpan(
                text: label,
                style: HaloType.label.copyWith(
                  color: t.muted2,
                  fontWeight: FontWeight.w600,
                ),
                children: [
                  if (required)
                    TextSpan(
                      text: ' *',
                      style: HaloType.label.copyWith(
                        color: t.point,
                        fontWeight: FontWeight.w700,
                      ),
                    ),
                ],
              ),
            ),
          ),
          TextFormField(
            controller: controller,
            keyboardType: keyboardType,
            maxLines: maxLines,
            validator: validator,
            style: HaloType.value.copyWith(color: t.text),
            decoration: InputDecoration(hintText: hint),
          ),
        ],
      ),
    );
  }
}
