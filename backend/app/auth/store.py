"""In-memory user store."""
from app.auth.models import UserRecord


class UserStore:
    def __init__(self):
        self.users: dict[str, UserRecord] = {}
        self.by_email: dict[str, str] = {}

    def add(self, user: UserRecord):
        self.users[user.id] = user
        self.by_email[user.email.lower()] = user.id

    def get_by_email(self, email: str) -> UserRecord | None:
        uid = self.by_email.get(email.lower())
        return self.users.get(uid) if uid else None

    def get_by_id(self, uid: str) -> UserRecord | None:
        return self.users.get(uid)


user_store = UserStore()
