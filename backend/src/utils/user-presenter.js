function toPublicUser(user) {
  if (!user) {
    return null;
  }

  return {
    id: user.id,
    login_id: user.login_id,
    email: user.email,
    full_name: user.full_name,
    address: user.address,
    mobile_number: user.mobile_number,
    position: user.position,
    profile_photo_mime: user.profile_photo_mime,
    is_active: Boolean(user.is_active),
    roles: user.roles || [],
    created_at: user.created_at,
    updated_at: user.updated_at
  };
}

module.exports = {
  toPublicUser
};
