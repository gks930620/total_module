package com.test.test.stomp.model;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public record RoomCreateRequest(
    @NotBlank(message = "채팅방 이름은 필수입니다.")
    @Size(max = 50, message = "채팅방 이름은 50자 이하여야 합니다.")
    String name
) {
}

