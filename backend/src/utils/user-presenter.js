function toPublicUser(user) {
  if (!user) {
    return null;
  }

  const profilePhotoBase64 = user.profile_photo 
    ? (Buffer.isBuffer(user.profile_photo) 
        ? user.profile_photo.toString('base64') 
        : user.profile_photo)
    : null;

  return {
    id: user.id,
    login_id: user.login_id,
    email: user.email,
    full_name: user.full_name,
    address: user.address,
    mobile_number: user.mobile_number,
    position: user.position,
    profile_photo: profilePhotoBase64,
    profile_photo_mime: user.profile_photo_mime,
    is_active: Boolean(user.is_active),
    roles: user.roles || [],
    role_codes: user.role_codes || (user.roles ? (user.roles.length && typeof user.roles[0] === 'object' ? user.roles.map(r => r.code).join(',') : user.roles.join(',')) : ''),
    created_at: user.created_at,
    updated_at: user.updated_at
  };
}

module.exports = {
  toPublicUser
};
