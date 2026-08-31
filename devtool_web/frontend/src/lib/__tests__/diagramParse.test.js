// 코드 → 다이어그램 모델 파서 — 구현 전 선작성(Red).
//
// 이 도구의 존재 이유가 여기 있다. mermaid 문법을 배우게 하면 mermaid.live 와 다를 게 없다.
// **이미 갖고 있는 코드를 붙여넣으면 그림이 나오는 것** 이 우리가 더하는 값이다.
// 그래서 파서는 "잘 쓴 코드" 가 아니라 **실제로 굴러다니는 코드** 를 읽어야 한다.
//
// lib/dummy.js 의 parseSchema 와는 다른 물건이다. 저쪽은 한 테이블을 더미데이터용으로
// 읽고(nullPercent·params), 이쪽은 **여러 엔티티와 그 사이의 관계** 를 읽는다.
import { describe, it, expect } from "vitest";
import { parseDdl, parseJavaSource } from "../diagram/parseCode.js";

describe("parseDdl — CREATE TABLE 을 읽는다", () => {
  const SQL = `
    CREATE TABLE member (
      id       BIGINT       NOT NULL AUTO_INCREMENT,
      email    VARCHAR(255) NOT NULL UNIQUE,
      nickname VARCHAR(50),
      PRIMARY KEY (id)
    );

    CREATE TABLE orders (
      id        BIGINT NOT NULL PRIMARY KEY,
      member_id BIGINT NOT NULL,
      amount    DECIMAL(12,2),
      CONSTRAINT fk_orders_member FOREIGN KEY (member_id) REFERENCES member(id)
    );
  `;

  it("테이블을 전부 찾는다", () => {
    const m = parseDdl(SQL);
    expect(m.entities.map((e) => e.name)).toEqual(["member", "orders"]);
  });

  it("컬럼과 타입을 읽는다", () => {
    const { entities } = parseDdl(SQL);
    const member = entities.find((e) => e.name === "member");
    expect(member.fields.map((f) => f.name)).toEqual(["id", "email", "nickname"]);
    expect(member.fields[1].type.toLowerCase()).toContain("varchar");
  });

  it("PRIMARY KEY 를 테이블 끝에 따로 쓴 경우도 잡는다", () => {
    const member = parseDdl(SQL).entities.find((e) => e.name === "member");
    expect(member.fields.find((f) => f.name === "id").pk).toBe(true);
  });

  it("컬럼 줄에 바로 쓴 PRIMARY KEY 도 잡는다", () => {
    const orders = parseDdl(SQL).entities.find((e) => e.name === "orders");
    expect(orders.fields.find((f) => f.name === "id").pk).toBe(true);
  });

  it("UNIQUE 와 NOT NULL 을 구분한다", () => {
    const member = parseDdl(SQL).entities.find((e) => e.name === "member");
    const email = member.fields.find((f) => f.name === "email");
    const nickname = member.fields.find((f) => f.name === "nickname");
    expect(email.unique).toBe(true);
    expect(email.nullable).toBe(false);
    expect(nickname.nullable).toBe(true);
  });

  it("FOREIGN KEY 로 관계를 만든다 — 이게 없으면 그냥 상자 모음이다", () => {
    const { relations } = parseDdl(SQL);
    expect(relations).toHaveLength(1);
    expect(relations[0]).toMatchObject({ from: "member", to: "orders", kind: "fk" });
  });

  it("FK 컬럼에 표시를 남긴다", () => {
    const orders = parseDdl(SQL).entities.find((e) => e.name === "orders");
    expect(orders.fields.find((f) => f.name === "member_id").fk).toBe(true);
  });

  it("컬럼 줄에 바로 쓴 REFERENCES 도 관계가 된다", () => {
    const m = parseDdl(`
      CREATE TABLE a (id INT PRIMARY KEY);
      CREATE TABLE b (a_id INT REFERENCES a(id));
    `);
    expect(m.relations).toHaveLength(1);
    expect(m.relations[0]).toMatchObject({ from: "a", to: "b" });
  });

  it("ALTER TABLE 로 나중에 붙인 FK 도 읽는다", () => {
    const m = parseDdl(`
      CREATE TABLE a (id INT PRIMARY KEY);
      CREATE TABLE b (a_id INT);
      ALTER TABLE b ADD CONSTRAINT fk_b_a FOREIGN KEY (a_id) REFERENCES a (id);
    `);
    expect(m.relations).toHaveLength(1);
    expect(m.relations[0]).toMatchObject({ from: "a", to: "b", kind: "fk" });
  });

  it("따옴표로 감싼 식별자를 벗긴다 — 방언마다 다르다", () => {
    const m = parseDdl('CREATE TABLE `order` (`id` INT PRIMARY KEY, "name" VARCHAR(10), [qty] INT);');
    expect(m.entities[0].name).toBe("order");
    expect(m.entities[0].fields.map((f) => f.name)).toEqual(["id", "name", "qty"]);
  });

  it("스키마 접두사를 떼어 낸다", () => {
    const m = parseDdl("CREATE TABLE public.member (id INT PRIMARY KEY);");
    expect(m.entities[0].name).toBe("member");
  });

  it("존재하지 않는 테이블을 가리키는 FK 는 관계로 만들지 않고 알려 준다", () => {
    const m = parseDdl(`
      CREATE TABLE b (a_id INT, FOREIGN KEY (a_id) REFERENCES ghost(id));
    `);
    expect(m.relations).toHaveLength(0);
    expect(m.warnings.join(" ")).toContain("ghost");
  });

  it("읽을 게 없으면 빈 모델과 이유를 준다", () => {
    const m = parseDdl("이건 SQL 이 아니다");
    expect(m.entities).toHaveLength(0);
    expect(m.warnings.length).toBeGreaterThan(0);
  });
});

describe("parseJavaSource — 자바 클래스를 읽는다", () => {
  const JAVA = `
    package com.example.shop;

    import jakarta.persistence.*;
    import java.util.List;

    @Entity
    @Table(name = "member")
    public class Member extends BaseEntity implements Serializable {
        @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
        private Long id;

        @Column(nullable = false, unique = true)
        private String email;

        @OneToMany(mappedBy = "member")
        private List<Order> orders = new ArrayList<>();

        public String getEmail() { return email; }
        protected void rename(String name) { }
    }

    @Entity
    public class Order {
        @Id private Long id;

        @ManyToOne(fetch = FetchType.LAZY)
        @JoinColumn(name = "member_id")
        private Member member;
    }

    public interface Payable {
        void pay(long amount);
    }

    public enum Status { READY, PAID, CANCELLED }
  `;

  it("클래스·인터페이스·enum 을 종류까지 구분해 찾는다", () => {
    const m = parseJavaSource(JAVA);
    const byName = Object.fromEntries(m.entities.map((e) => [e.name, e.kind]));
    expect(byName.Member).toBe("class");
    expect(byName.Order).toBe("class");
    expect(byName.Payable).toBe("interface");
    expect(byName.Status).toBe("enum");
  });

  it("필드의 타입과 접근 제어자를 읽는다", () => {
    const member = parseJavaSource(JAVA).entities.find((e) => e.name === "Member");
    const email = member.fields.find((f) => f.name === "email");
    expect(email.type).toBe("String");
    expect(email.visibility).toBe("-");
  });

  it("@Id 를 PK 로 본다", () => {
    const member = parseJavaSource(JAVA).entities.find((e) => e.name === "Member");
    expect(member.fields.find((f) => f.name === "id").pk).toBe(true);
  });

  it("@Column(nullable=false, unique=true) 를 읽는다", () => {
    const member = parseJavaSource(JAVA).entities.find((e) => e.name === "Member");
    const email = member.fields.find((f) => f.name === "email");
    expect(email.nullable).toBe(false);
    expect(email.unique).toBe(true);
  });

  it("메서드를 읽는다 — 필드와 섞이면 안 된다", () => {
    const member = parseJavaSource(JAVA).entities.find((e) => e.name === "Member");
    expect(member.fields.map((f) => f.name)).not.toContain("getEmail");
    expect(member.methods.map((x) => x.name)).toEqual(["getEmail", "rename"]);
    expect(member.methods[0]).toMatchObject({ visibility: "+", returns: "String" });
    expect(member.methods[1].visibility).toBe("#");
  });

  it("extends 를 상속 관계로 만든다", () => {
    const m = parseJavaSource(JAVA);
    expect(m.relations).toContainEqual(expect.objectContaining({
      from: "BaseEntity", to: "Member", kind: "extends",
    }));
  });

  it("implements 를 구현 관계로 만든다", () => {
    const m = parseJavaSource(JAVA);
    expect(m.relations).toContainEqual(expect.objectContaining({
      from: "Serializable", to: "Member", kind: "implements",
    }));
  });

  // 양쪽에서 각각 하나씩 나온다 — 방향을 헷갈리면 그림이 거꾸로 그려진다.
  it("@ManyToOne 은 자식 → 부모 방향이다", () => {
    const rel = parseJavaSource(JAVA).relations.find(
      (r) => r.from === "Order" && r.to === "Member" && r.kind === "association"
    );
    expect(rel.label).toContain("ManyToOne");
    expect(rel.fromCard).toBe("1");
    expect(rel.toCard).toBe("N");
  });

  it("@OneToMany 는 부모 → 자식 방향이다", () => {
    const rel = parseJavaSource(JAVA).relations.find(
      (r) => r.from === "Member" && r.to === "Order" && r.kind === "association"
    );
    expect(rel.label).toContain("OneToMany");
  });

  it("List<Order> 같은 컬렉션에서 알맹이 타입을 꺼낸다", () => {
    const member = parseJavaSource(JAVA).entities.find((e) => e.name === "Member");
    const orders = member.fields.find((f) => f.name === "orders");
    expect(orders.type).toBe("List<Order>");
    // 관계는 알맹이(Order)로 이어져야 한다 — List 로 이으면 아무 의미가 없다
    expect(parseJavaSource(JAVA).relations.some((r) => r.to === "List")).toBe(false);
  });

  it("자바 기본 타입·표준 라이브러리로는 관계를 만들지 않는다", () => {
    const m = parseJavaSource(JAVA);
    for (const t of ["String", "Long", "long", "List", "ArrayList"]) {
      expect(m.relations.some((r) => r.from === t || r.to === t), t).toBe(false);
    }
  });

  it("record 도 읽는다", () => {
    const m = parseJavaSource("public record Point(int x, int y) {}");
    expect(m.entities[0]).toMatchObject({ name: "Point", kind: "record" });
    expect(m.entities[0].fields.map((f) => f.name)).toEqual(["x", "y"]);
  });

  it("주석 안의 코드에 속지 않는다", () => {
    const m = parseJavaSource(`
      // class Ghost {}
      /* class AlsoGhost { private String x; } */
      public class Real { private int a; }
    `);
    expect(m.entities.map((e) => e.name)).toEqual(["Real"]);
  });

  it("읽을 게 없으면 빈 모델과 이유를 준다", () => {
    const m = parseJavaSource("그냥 글");
    expect(m.entities).toHaveLength(0);
    expect(m.warnings.length).toBeGreaterThan(0);
  });
});
