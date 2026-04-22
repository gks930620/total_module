package com.test.test.stomp.controller;

import com.test.test.stomp.model.ChatMessage;
import lombok.RequiredArgsConstructor;
import org.springframework.messaging.Message;
import org.springframework.messaging.handler.annotation.DestinationVariable;
import org.springframework.messaging.handler.annotation.MessageMapping;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.messaging.simp.stomp.StompHeaderAccessor;
import org.springframework.security.core.Authentication;
import org.springframework.stereotype.Controller;

@Controller
@RequiredArgsConstructor
public class ChatController {

    private final SimpMessagingTemplate messagingTemplate;

    // 클라이언트 -> 서버
    @MessageMapping("/room/{roomId}")   //pub일 때, send일 때만 옴
    public void sendMessage(
        @DestinationVariable String roomId,
        ChatMessage message,
        Message<?> msg
    ) {
        StompHeaderAccessor accessor = StompHeaderAccessor.wrap(msg);
        Object sessionUser = accessor.getSessionAttributes().get("user");
        Authentication auth = (Authentication) sessionUser;
        String username = auth.getName();
        message.setSender(username);
        messagingTemplate.convertAndSend("/sub/room/" + roomId, message);
    }
}

