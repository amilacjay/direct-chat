"""Kafka event bus for presence/system events.

Used only for ephemeral events (presence changes, notification delivery).
Message content is NEVER published here. Degrades gracefully if Kafka is off.
"""
import asyncio
import json
import logging
from typing import Awaitable, Callable, Optional

from app.config import settings

logger = logging.getLogger("kafka_bus")

try:
    from aiokafka import AIOKafkaConsumer, AIOKafkaProducer
    _HAS_AIOKAFKA = True
except Exception:  # pragma: no cover
    _HAS_AIOKAFKA = False

TOPIC_PRESENCE = "user.presence"
TOPIC_NOTIFICATIONS = "system.notifications"

_producer: Optional["AIOKafkaProducer"] = None
_consumers: list = []


async def start_producer() -> None:
    global _producer
    if not settings.kafka_enabled or not _HAS_AIOKAFKA:
        logger.warning("Kafka disabled or aiokafka missing; events run in-process only")
        return
    try:
        _producer = AIOKafkaProducer(
            bootstrap_servers=settings.kafka_bootstrap_servers
        )
        await _producer.start()
        logger.info("Kafka producer started")
    except Exception as exc:  # pragma: no cover
        logger.error("Kafka producer failed to start: %s", exc)
        _producer = None


async def stop() -> None:
    global _producer
    if _producer:
        await _producer.stop()
        _producer = None
    for c in _consumers:
        try:
            await c.stop()
        except Exception:
            pass
    _consumers.clear()


async def publish(topic: str, event: dict) -> None:
    if _producer is None:
        return
    try:
        await _producer.send_and_wait(topic, json.dumps(event).encode())
    except Exception as exc:  # pragma: no cover
        logger.error("Kafka publish failed: %s", exc)


async def consume(
    topic: str, group_id: str, handler: Callable[[dict], Awaitable[None]]
) -> None:
    if not settings.kafka_enabled or not _HAS_AIOKAFKA:
        return
    try:
        consumer = AIOKafkaConsumer(
            topic,
            bootstrap_servers=settings.kafka_bootstrap_servers,
            group_id=group_id,
        )
        await consumer.start()
        _consumers.append(consumer)
    except Exception as exc:  # pragma: no cover
        logger.error("Kafka consumer failed to start: %s", exc)
        return

    async def _loop():
        async for msg in consumer:
            try:
                await handler(json.loads(msg.value.decode()))
            except Exception as exc:  # pragma: no cover
                logger.error("Kafka handler error: %s", exc)

    asyncio.create_task(_loop())
